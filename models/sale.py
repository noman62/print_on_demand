# -*- coding: utf-8 -*-


import logging, re
from collections import Counter

from odoo import _, api, fields, models
from odoo.http import request
from odoo.tools.image import image_process

logger = logging.getLogger(__name__)


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    print_on_demand_line = fields.Boolean(string='', copy=True)
    design_line_ids = fields.One2many('line.custom.design', 'line_id', copy=True)
    service_charge = fields.Float(string='Extra Charge', default=0.0)
    setup_charge = fields.Float(string='Setup Charge', default=0.0)
    size = fields.Char(string='Size')
    custom_design = fields.Text('Custom Design Data')
    design_data = fields.Text('Design Data')  # Added missing field

    @api.depends('product_uom_qty', 'discount', 'price_unit', 'tax_id', 'service_charge', 'setup_charge')
    def _compute_amount(self):
        """
        Compute the amounts of the SO line.
        """
        for line in self:
            if line.setup_charge > 0:
                line.price_unit += line.setup_charge
                tax_results = self.env['account.tax']._compute_taxes([
                    line._convert_to_tax_base_line_dict()
                ])
                totals = list(tax_results['totals'].values())[0]
                amount_untaxed = totals['amount_untaxed']
                amount_tax = totals['amount_tax']

                line.update({
                    'price_subtotal': amount_untaxed,
                    'price_tax': amount_tax,
                    'price_total': amount_untaxed + amount_tax,
                })
            elif line.service_charge > 0:
                line.price_unit += line.service_charge
                tax_results = self.env['account.tax']._compute_taxes([
                    line._convert_to_tax_base_line_dict()
                ])
                totals = list(tax_results['totals'].values())[0]
                amount_untaxed = totals['amount_untaxed']
                amount_tax = totals['amount_tax']

                line.update({
                    'price_subtotal': amount_untaxed,
                    'price_tax': amount_tax,
                    'price_total': amount_untaxed + amount_tax,
                })
            else:
                tax_results = self.env['account.tax']._compute_taxes([
                    line._convert_to_tax_base_line_dict()
                ])
                totals = list(tax_results['totals'].values())[0]
                amount_untaxed = totals['amount_untaxed']
                amount_tax = totals['amount_tax']

                line.update({
                    'price_subtotal': amount_untaxed,
                    'price_tax': amount_tax,
                    'price_total': amount_untaxed + amount_tax,
                })

    def action_url_print_on_demand_design(self):
        view = self.env.ref('print_on_demand.sale_order_line_view_form_web').id
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'sale.order.line',
            'res_id': self.id,
            'view_mode': 'form',
            'view_id': view,
            'target': 'self'
        }


class DesignLine(models.Model):
    _name = 'line.custom.design'
    _description = 'custom design lines'

    name = fields.Char(string='')
    line_id = fields.Many2one('sale.order.line', string='')
    design = fields.Binary(string='')
    text = fields.Html(string='')
    image = fields.Binary(string='')
    image_name = fields.Char()
    printing_type = fields.Char()
    number_of_colors = fields.Char()
    player_list = fields.Html(string='')
    bulk_order = fields.Html(string='')

    def action_download_design(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': f'/web/image/line.custom.design/{self.id}/design?download=True&mimetype=PNG',
        }

    def action_report_design_content(self):
        return self.env.ref('print_on_demand.action_report_print_on_demand_design').report_action(self)


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def _cart_update(self, product_id=None, line_id=None, add_qty=0, set_qty=0, **kwargs):
        if request.context.get('print_on_demand'):
            line_id = False
        elif line_id == None:
            line = self.env['sale.order.line'].search(
                [('order_id', '=', self.id), ('product_id', '=', product_id), ('print_on_demand_line', '=', False)])
            if line:
                line_id = line.id
            else:
                line_id = False
        res = super(SaleOrder, self)._cart_update(product_id, line_id, add_qty, set_qty, **kwargs)
        if request.context.get('print_on_demand'):
            line = self.env['sale.order.line'].browse(res['line_id'])
            content = request.context.get('design_content')
            printing_type = ""
            printing_charge = 0.0
            size_count = {}
            bulk_order_sizes = {}
            available_sizes = []
            number_of_colors = 0
            printing_sides = []
            flag = False

            product_template = self.env['product.template'].search([
                ('name', '=', line.product_id.name)
            ])
            if product_template:
                for variant in product_template.product_variant_ids:
                    for val in variant.product_template_attribute_value_ids:
                        if val.attribute_id.is_size_attribute_for_customizable_products:
                            if val.name not in available_sizes:
                                available_sizes.append(val.name)

            if content:
                for obj in content:
                    dictionary = obj[2]  # Access the dictionary directly at index 2
                    if not flag:
                        printing_type = dictionary.get('printing_type', None)
                        number_of_colors = int(dictionary.get('number_of_colors', 0))
                        flag = True
                    player_list = dictionary.get('player_list', None)
                    bulk_order = dictionary.get('bulk_order', None)
                    printing_sides.append(dictionary.get('name', None))

                    if player_list and available_sizes:

                        # Create a regex pattern from available_sizes
                        sizes_pattern = r'<td>({})</td>'.format('|'.join(available_sizes))

                        # Use the dynamically created pattern in re.findall
                        sizes = re.findall(sizes_pattern, player_list)
                        # Count the occurrences of each size
                        for size in sizes:
                            if size in size_count:
                                size_count[size] += 1
                            else:
                                size_count[size] = 1

                    if bulk_order:
                        pattern = r'<td>(\w+)</td><td>(\d+)</td>'
                        matches = re.findall(pattern, bulk_order)

                        # Convert matches to a dictionary
                        bulk_order_sizes = {size: int(count) for size, count in matches if int(count) > 0}

            merged_size_count = {}
            if bulk_order_sizes or size_count:
                merged_size_count = dict(Counter(size_count) + Counter(bulk_order_sizes))

            products = self.env['product.product'].search([
                ('id', '=', line.product_id.id)
            ])

            other_variants = []

            if available_sizes:
                for new_obj in products.product_template_variant_value_ids:
                    if new_obj.name in available_sizes:
                        continue
                    else:
                        other_variants.append(new_obj.id)

            products = self.env['product.product'].search([
                ('name', '=', line.product_template_id.name)
            ])
            filtered_products = []
            for p in products:
                variant_ids = p.product_template_variant_value_ids.ids
                if self.is_subsequence(other_variants, variant_ids):
                    filtered_products.append(p)

            product_qty = sum(merged_size_count.values())

            printing_charge, setup_charge = self.calculate_printing_charge(printing_type, number_of_colors, product_qty,
                                                                           printing_sides)

            setup_service_product = self.env['product.product'].search([('is_setup_service', '=', True)], limit=1)

            custom_service_product = self.env['product.product'].search([('is_custom_service', '=', True)], limit=1)

            if line:
                if merged_size_count:
                    line.unlink()
                    for size, count in merged_size_count.items():
                        if products:
                            for obj in filtered_products:
                                for var in obj.product_template_variant_value_ids:
                                    if size == var.name:
                                        line.create({
                                            'order_id': self.id,
                                            'print_on_demand_line': True,
                                            'design_line_ids': content,
                                            'setup_charge': 0.0,
                                            'service_charge': 0.0,
                                            'product_uom_qty': count,
                                            'product_id': obj.id
                                        })
                else:
                    line.write({
                        'print_on_demand_line': True,
                        'design_line_ids': content,
                    })

                if setup_service_product:
                    line.create({
                        'order_id': self.id,
                        'setup_charge': setup_charge,
                        'service_charge': 0.0,
                        'product_id': setup_service_product.id
                    })
                if custom_service_product:
                    line.create({
                        'order_id': self.id,
                        'setup_charge': 0.0,
                        'service_charge': printing_charge * product_qty,
                        'product_id': custom_service_product.id
                    })
        return res

    def calculate_printing_charge(self, printing_type, number_of_colors, product_qty, sides):
        # Retrieve the printing type object based on the name
        printing_type_obj = self.env['printing.type'].search([('name', '=', printing_type)], limit=1)

        if not printing_type_obj:
            return 0

        # Calculate the operation price from extra_price and setup_price
        setup_price = printing_type_obj.setup_price
        printing_charge = 0.0

        # Check if the pricing type is fixed_price
        if printing_type_obj.pricing_type == 'fixed_price':
            # Retrieve all the printing type lines for the given printing type
            printing_type_line_obj = self.env['printing.type.line'].search(
                [('printing_type_id', '=', printing_type_obj.id)])

            # Iterate over each side in the printing_sides array
            for side in sides:
                side_charge = 0.0

                # Find the applicable line for the current side and product quantity
                for line in printing_type_line_obj:
                    if product_qty >= line.min_product and line.print_sides_id.name == side:
                        side_charge = line.price

                # Add the side charge to the total printing charge
                printing_charge += side_charge

        elif printing_type_obj.pricing_type == 'compute_price_based_on_elements':
            printing_type_line_obj = self.env['printing.type.line'].search(
                [('printing_type_id', '=', printing_type_obj.id)])
            if printing_type_line_obj:
                for line in printing_type_line_obj:
                    if product_qty >= line.min_product:
                        printing_charge = (
                                line.text_charge +
                                line.image_charge +
                                line.clipart_charge +
                                line.name_and_number_charge
                        )

        elif printing_type_obj.pricing_type == 'compute_price_based_on_colors':
            printing_type_line_obj = self.env['printing.type.line'].search(
                [('printing_type_id', '=', printing_type_obj.id)])
            # Iterate over each side in the printing_sides array
            for side in sides:
                side_charge = 0.0

                # Find the applicable line for the current side and product quantity
                for line in printing_type_line_obj:
                    if product_qty >= line.min_product and line.print_sides_id.name == side:
                        color_prices = [
                            line.color_1,
                            line.color_2,
                            line.color_3,
                            line.color_4,
                            line.color_5,
                            line.color_6
                        ]
                        side_charge = color_prices[number_of_colors - 1]

                # Add the side charge to the total printing charge
                printing_charge += side_charge

        return printing_charge, setup_price

    def is_subsequence(self, sub, main):
        it = iter(main)
        return all(any(item == elem for elem in it) for item in sub)

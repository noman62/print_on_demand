# -*- coding: utf-8 -*-

import logging, json
import base64
from PIL import Image
from io import BytesIO
from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.tools import image_process

_logger = logging.getLogger(__name__)

class ProductTemplate(models.Model):

    _inherit = 'product.template'

    is_print_on_demand = fields.Boolean(string='Print On Demand',copy=True)
    is_setup_service = fields.Boolean(string='Setup Service',copy=True)
    is_custom_service = fields.Boolean(string='Custom Service',copy=True)
    has_custom_design = fields.Boolean('Has Custom Design')
    custom_area_ids = fields.One2many('product.custom.area', 'product_id', string='',copy=True)

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS                                        
    # -------------------------------------------------------------------------
    @api.constrains('is_setup_service', 'is_custom_service')
    def _check_unique_service_product(self):
        for record in self:
            if record.is_setup_service:
                # Check if another product has is_setup_service = True
                domain = [('id', '!=', record.id), ('is_setup_service', '=', True)]
                if self.search_count(domain) > 0:
                    raise ValidationError(
                        "Only one product can have 'Setup Service' enabled."
                    )
            if record.is_custom_service:
                # Check if another product has is_custom_service = True
                domain = [('id', '!=', record.id), ('is_custom_service', '=', True)]
                if self.search_count(domain) > 0:
                    raise ValidationError(
                        "Only one product can have 'Custom Service' enabled."
                    )


    @api.constrains('custom_area_ids')
    def _check_value_availablity(self):
        for record in self:
            if record.is_print_on_demand and not record.custom_area_ids:
                raise UserError(_("You cann't save record without custom area field data."))

    @api.model
    def create(self, vals):
        if 'is_print_on_demand' in vals and vals['is_print_on_demand'] == True and 'custom_area_ids' not in vals:
            raise UserError(_('Please select the image for customization'))
        return super(ProductTemplate,self).create(vals)

    def write(self, vals):
        if 'is_print_on_demand' in vals and vals['is_print_on_demand'] == True and ('custom_area_ids' not in vals and not self.custom_area_ids):
            raise UserError(_('Please select the image for customization'))

        res =  super(ProductTemplate,self).write(vals)

        if 'is_print_on_demand' in vals and vals['is_print_on_demand'] == True and self.custom_area_ids:
            for rec in self.custom_area_ids:
                if rec.provide_image == False and  rec.provide_text == False:
                    raise UserError(_(f"You have to select atleast one from (Provide Image or Provide Text) in {rec.name}."))

        if not self.custom_area_ids and not self._context.get('disable_print_on_demand'):
            self.with_context(disable_print_on_demand=True).write({
                'is_print_on_demand':False
            })
        return res

class ProductDimension(models.Model):
    _name = 'product.custom.area'
    _description = 'custom area for product template'
    _order = 'sequence'
    name = fields.Char(required=True)
    provide_image = fields.Boolean(string='Provide Image', default=True)
    provide_text = fields.Boolean(string='Provide Text', default=True)
    provide_team_members = fields.Boolean(string='Provide Team Members', default=True)
    is_bulk_ordering = fields.Boolean(string='Bulk Ordering', default=True)
    width = fields.Char()
    height = fields.Char()
    top = fields.Char()
    left = fields.Char()
    web_image = fields.Binary(required=True)
    sequence = fields.Integer()
    product_id = fields.Many2one('product.template')
    note = fields.Text()
    product_variant_ids = fields.Many2many('product.product', string='Product Variants', domain="[('product_tmpl_id', '=', product_id)]")
    provide_printing_types = fields.Boolean(string='Choose Printing Types', default=False)
    printing_type_ids = fields.Many2many('printing.type', string='Printing Types')
    print_side_id = fields.Many2one('print.sides', string='Side')

    @api.model
    def create(self,vals):
        for p in ['width','height','top','left']:
            if vals[p] == False:
                raise UserError(_('Area not selected in %s'%vals['name']))

        res = super(ProductDimension,self).create(vals)
        seq = self.search([('product_id','=',res.product_id.id)], limit=1, order="sequence DESC")
        res.write({
            'sequence':seq and seq.sequence + 1 or 1
        })
        return res

    @api.constrains('provide_image','provide_text')
    def _check_provide_image_text(self):
        if self.product_id.is_print_on_demand == True and  not self.provide_image and not self.provide_text:
                raise UserError(_(f"You have to select atleast one from (Provide Image or Provide Text) in {self.name}."))

    @api.constrains('provide_image','provide_text')
    def _check_provide_image_text(self):
        if self.product_id.is_print_on_demand == True and  not self.provide_image and not self.provide_text:
                raise UserError(_(f"You have to select atleast one from (Provide Image or Provide Text) in {self.name}."))

    @api.model
    def get_canvas_properties(self,id):
        if id:
            rec = self.env['product.custom.area'].browse(int(id))
            return {
                'width':rec.width,
                'height':rec.height,
                'top':rec.top,
                'left':rec.left
            }
        else:
            return {
                'width':200,
                'height':200,
                'top':157,
                'left':71
            }

    # @api.onchange('web_image')
    # def _onchange_web_image(self):
    #     if self.web_image:
    #         self.web_image = self._resize_image(self.web_image)

    # def _resize_image(self, image_base64):
    #     try:
    #         # Decode the base64 image
    #         image_data = base64.b64decode(image_base64)
    #         image = Image.open(BytesIO(image_data))

    #         # Resize the image to 500x500
    #         image = image.resize((500, 500), Image.ANTIALIAS)

    #         # Save the resized image to a BytesIO object
    #         buffered = BytesIO()
    #         image.save(buffered, format="PNG")
    #         img_str = base64.b64encode(buffered.getvalue())

    #         return img_str.decode('utf-8')
    #     except Exception as e:
    #         raise ValidationError(f"Image resizing failed: {e}")

    @api.onchange('print_side_id')
    def _onchange_print_side_id(self):
        if self.print_side_id:
            self.name = self.print_side_id.name
        else:
            self.name = ''


class ProductProduct(models.Model):
    _inherit = 'product.product'

    def get_printing_types(self):
        product_template = self.env['product.template'].search([
            ('name', '=', self.name)
        ])
        product_custom_area = self.env['product.custom.area'].search([
            ('product_id', '=', product_template.id)
        ])
        printing_types = []
        if product_custom_area:
            for obj in product_custom_area:
                if obj.printing_type_ids:
                    for val in obj.printing_type_ids:
                        # Calculate the minimum value of min_product
                        min_qty = min(line.min_product for line in val.printing_type_line_ids) if val.printing_type_line_ids else 0

                        printing_type_data = {
                            'name': val.name,
                            'pricing_type': val.pricing_type,
                            'min_qty': min_qty  # Include the minimum quantity
                        }
                        if printing_type_data not in printing_types:
                            printing_types.append(printing_type_data)

        return json.dumps({
            'printing_types': printing_types,
        })


    def to_json(self):
        product_template = self.env['product.template'].search([
                ('name', '=', self.name)
            ])
        available_sizes = []
        if product_template:
            for variant in product_template.product_variant_ids:
                for val in variant.product_template_attribute_value_ids:
                    if val.attribute_id.is_size_attribute_for_customizable_products:
                        if val.name in available_sizes:
                            continue
                        else:
                            available_sizes.append(val.name)
        return json.dumps({
            'available_sizes': available_sizes,
        })

class ProductAttribute(models.Model):

    _inherit = 'product.attribute'

    is_size_attribute_for_customizable_products = fields.Boolean(string="Size Attribute for Customizable Products")





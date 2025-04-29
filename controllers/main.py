# -*- coding: utf-8 -*-

import logging, base64, json
from werkzeug.exceptions import NotFound

from odoo import http
from odoo.http import request
from odoo.addons.website.controllers.main import QueryURL
from odoo.addons.website_sale.controllers.main import WebsiteSale

_logger = logging.getLogger(__name__)


class WebsiteSaleCustom(WebsiteSale):

    @http.route(['/custom/design/<model("product.product"):product>'], auth="public", type="http", website=True,
                sitemap=False)
    def wtp_custom_product(self, product, **kwargs):
        if not product.is_print_on_demand:
            raise NotFound()
        ir_default = request.env['ir.default'].sudo()
        tnc = ir_default._get('res.config.settings', 'wtp_enable_tnc')
        if tnc:
            wtp_tnc = ir_default._get('res.config.settings', 'wtp_tnc_text')
        keep = QueryURL('/shop')
        return request.render('print_on_demand.custom_product', {
            'product': product,
            'keep': keep,
            'wtp_tnc': wtp_tnc if tnc else False
        })

    @http.route(['/shop/cart/update'], type='http', auth="public", methods=['POST'], website=True, csrf=False)
    def cart_update(self, product_id, add_qty=1, set_qty=0, product_custom_attribute_values=None,
                    no_variant_attribute_values=None, express=False, custom_design=None, **kwargs):

        # Handle print on demand orders
        if kwargs.get('print_on_demand_order') == 'True':
            # Your existing code
            return request.redirect('/shop/cart')

        # Handle custom design orders
        elif custom_design:
            # Call the original cart_update method
            response = request.env['website'].get_current_website().sale_get_order(force_create=1)._cart_update(
                product_id=int(product_id),
                add_qty=float(add_qty),
                **kwargs  # Change from **kw to **kwargs
            )

            # Save custom design data to the order line
            if response.get('line_id'):
                order_line = request.env['sale.order.line'].sudo().browse(response['line_id'])
                order_line.write({
                    'custom_design': custom_design
                })

            return request.redirect("/shop/cart")

        # Handle regular orders
        else:
            return super(WebsiteSaleCustom, self).cart_update(product_id, add_qty, set_qty,
                                                              product_custom_attribute_values,
                                                              no_variant_attribute_values, express, **kwargs)

    # This route is outside of any class, so it should not have 'self' parameter
    @http.route('/shop/printing_types', type='http', auth="public", website=True, csrf=False)
    def get_printing_types(self):  # Remove 'self' parameter
        _logger.info("Endpoint /shop/printing_types called")
        printing_types = request.env['printing.type'].sudo().search([])
        result = []
        for printing_type in printing_types:
            result.append({
                'id': printing_type.id,
                'name': printing_type.name,
                'description': printing_type.description or '',
                'special_note': printing_type.special_note or '',
                'setup_price': float(printing_type.setup_price),
                'pricing_type': printing_type.pricing_type,
            })

        # Return HTTP response with JSON content
        return request.make_response(
            json.dumps(result),
            headers=[('Content-Type', 'application/json')]
        )
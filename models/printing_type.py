from odoo import fields, models


class PrintingType(models.Model):
    """Model that holds the printing types."""
    _name = "printing.type"
    _description = "Printing Type"
    _order = 'id'

    name = fields.Char(string="Name", help="Name of the printing type", required=True)
    description = fields.Char(string="Description", help="Description of the printing type")
    special_note = fields.Char(string="Special Note", help="Note for the printing type")
    setup_price = fields.Monetary(string="Setup Price", help="Setup price for the printing type")
    currency_id = fields.Many2one('res.currency', string="Currency", help="Currency", default=lambda self: self.env.company.currency_id)
    pricing_type = fields.Selection([
        ('fixed_price', 'Fixed Price'),
        ('compute_price_based_on_elements', 'Compute Price Based on Elements'), 
        ('compute_price_based_on_colors', 'Compute Price Based on Colors')
        ], 
        string="Pricing Type", help="Pricing type for the printing type", default='fixed_price')
    printing_type_line_ids = fields.One2many('printing.type.line', 'printing_type_id', string="Printing Type Line", help="Printing type line")


class PrintingTypeLine(models.Model):
    """Model that holds the printing type lines."""
    _name = "printing.type.line"
    _description = "Printing Type Line"
    _order = 'id'

    printing_type_id = fields.Many2one('printing.type', string="Printing Type", help="Printing type")
    pricing_type = fields.Char(string="Pricing Type", relate='printing_type_id.pricing_type', help="Pricing type for the printing type")
    min_product = fields.Integer(string="Minimum Number of Product", help="Minimum number product for the printing type")
    price = fields.Monetary(string="Price", help="Price for the Fixed Price pricing type")
    currency_id = fields.Many2one('res.currency', string="Currency", help="Currency", default=lambda self: self.env.company.currency_id)
    print_sides_id = fields.Many2one('print.sides', string="Available Sides", help="Available sides for the printing type")
    text_charge = fields.Monetary(string="Text Charge", help="Extra charge for adding text")
    image_charge = fields.Monetary(string="Image Charge", help="Extra charge for adding image")
    clipart_charge = fields.Monetary(string="Clipart Charge", help="Extra charge for adding clipart")
    name_and_number_charge = fields.Monetary(string="Name and Number Charge", help="Extra charge for adding name and number")
    color_1 = fields.Monetary(string="1", help="Price for 1 color")
    color_2 = fields.Monetary(string="2", help="Price for 2 colors")
    color_3 = fields.Monetary(string="3", help="Price for 3 colors")
    color_4 = fields.Monetary(string="4", help="Price for 4 colors")
    color_5 = fields.Monetary(string="5", help="Price for 5 colors")
    color_6 = fields.Monetary(string="6", help="Price for 6 colors")

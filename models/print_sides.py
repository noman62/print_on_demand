from odoo import fields, models


class PrintSides(models.Model):
    """Model that holds the Hotel Floors."""
    _name = "print.sides"
    _description = "Sides"
    _order = 'id desc'

    name = fields.Char(string="Name", help="Name of the side", required=True)
    description = fields.Char(string="Description", help="Description of the side")
# -*- coding: utf-8 -*-

import logging

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class ResConfig(models.TransientModel):
    _inherit = 'res.config.settings'
    
    wtp_enable_tnc = fields.Boolean(string='Show terms and conditions')
    wtp_tnc_text = fields.Text(string='Terms and conditions')

    @api.model
    def get_values(self):
        res = super(ResConfig, self).get_values()
        ir_default = self.env['ir.default']
        wtp_enable_tnc = ir_default._get('res.config.settings','wtp_enable_tnc')
        wtp_tnc_text = ir_default._get('res.config.settings','wtp_tnc_text')
        res.update(
            wtp_enable_tnc=wtp_enable_tnc,
            wtp_tnc_text=wtp_tnc_text
        )
        return res

    def set_values(self):
        res = super(ResConfig, self).set_values()
        ir_default = self.env['ir.default']
        ir_default.set("res.config.settings","wtp_enable_tnc",  self.wtp_enable_tnc)
        ir_default.set("res.config.settings","wtp_tnc_text",  self.wtp_tnc_text)
        return res

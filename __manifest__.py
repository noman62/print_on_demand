# -*- coding: utf-8 -*-

{
    'name': 'Print On Demand',
    'version': '1.0.0',
    'description': """
                Print On Demand Odoo addon
                Odoo Customize Product
                Design Product
                Print On Demand Customizable Product
                Print On Demand Product    
    """,
    'summary': 'This addons lets you customize your products on the odoo website. Customers can make their own design on products using text and images.',
    'author': '',
    'website': '',
    'license': 'Other proprietary',
    'category': 'Website',
    'live_test_url': '',
    'depends': ['website', 'website_sale'],
    'data': [
        'security/ir.model.access.csv',
        'data/data.xml',
        'views/report.xml',
        'views/sale_views.xml',
        'views/print_sides.xml',
        'views/printing_type.xml',
        'views/res_config_views.xml',
        'views/templates.xml'
    ],
    'demo': [
        'demo/demo.xml'
    ],
    "images": ['static/description/Banner.gif'],
    'auto_install': False,
    'installable': True,
    'application': True,
    'currency': 'USD',
    'price': 99,
    'pre_init_hook': 'pre_init_check',
    'assets': {
        'web.assets_frontend': [
            'print_on_demand/static/src/css/webtoprint.css',
            'print_on_demand/static/src/js/fabric.min.js',
            'print_on_demand/static/src/js/print_on_demand.js',
            'print_on_demand/static/src/js/custom.js',
        ],
        'web.assets_backend': [
            'print_on_demand/static/src/xml/area_select.xml',
            'print_on_demand/static/src/css/jquery-ui.css',
            'print_on_demand/static/src/components/**/*',
        ],
    }
}

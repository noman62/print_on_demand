/** @odoo-module **/

import { registry } from "@web/core/registry";
import { ImageField } from '@web/views/fields/image/image_field';
import { useService } from "@web/core/utils/hooks";
import { debounce } from "@web/core/utils/timing";
const { onPatched, onMounted, useRef } = owl;
import { loadJS } from "@web/core/assets";

loadJS('https://code.jquery.com/ui/1.13.2/jquery-ui.js')


class FieldAreaSelect extends ImageField {
    setup() {

        super.setup();
        this._rpc = useService('rpc');
        this.orm = useService("orm");
        this.imageContainerRef = useRef("imageContainer")
        this.root = useRef('root');
        onMounted(() => {
            this.updateImagePosition();
        })
        onPatched(this.updateImagePosition);
    }
    onFileUploaded(info) {
        if (info.type.replace(/^.*\./, "").split('/')[0] === 'image') {
            this.state.isValid = true;
            // Invalidate the `rawCacheKey`.
            // this.rawCacheKey = null;
            this.props.record.update({ [this.props.name]: info.data });
        }
        else {
            this.notification.add(this.env._t("Only image type attachment is allowed..."), {
                type: "danger",
            });

        }

    }


    updateImagePosition() {
        if (!this.imageContainerRef || !this.imageContainerRef.el) {
            return;
        }
        this.$el = $(this.imageContainerRef.el);
        if (this.props.record.data.web_image) {
            this.orm.call('product.custom.area', 'get_canvas_properties', [this.props.record.data.id]).then(props => {

                const height = this.props.record.data.height;
                const width = this.props.record.data.width;
                const top = this.props.record.data.top;
                const left = this.props.record.data.left;

                var canvas = jQuery(`<div class="ui-widget-content canvas_pos shadow" style="width:${width ? width : 200}px;height:${height ? height : 200}px;left:${left ? left : 71}px;top:${top ? top : 250}px;background:transparent;position:absolute">Drawing Area</div>`)

                canvas
                    .draggable({
                        "containment": "div[name='web_image']",
                        drag: debounce(this._on_save_area.bind(this), 500)
                    });
                canvas.resizable({
                    "containment": "div[name='web_image']",
                    resize: debounce(this._on_save_area.bind(this), 500),
                    handles: "n, s, e, w, se"
                });
                // .remove();
                if ($('.canvas_pos').html()) {
                    $('.canvas_pos').css(`{"width":${width ? width : 200}px;"height":${height ? height : 200}px;"left":${left ? left : 71}px;"top":${top ? top : 250}px}`)
                }
                else {

                    this.$el.append(canvas);
                }
            });
        }
    }

    _on_save_area() {
        var $el = this.$el
        var $canvas = $el.find('.canvas_pos');
        var pos = $canvas.position();
        this.props.record.update({
            'height': $canvas.height().toString(),
            'width': $canvas.width().toString(),
            'top': pos.top.toString(),
            'left': pos.left.toString()
        });
    }
}
FieldAreaSelect.template = "print_on_demand.area_select";
// registry.category("fields").add("area_select", FieldAreaSelect);

export const fieldAreaSelect = {
    component: FieldAreaSelect,
};

registry.category("fields").add("area_select", fieldAreaSelect);

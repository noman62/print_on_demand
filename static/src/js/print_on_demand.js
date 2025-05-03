/** @odoo-module **/

import {WebsiteSale} from '@website_sale/js/website_sale';
import {debounce} from "@web/core/utils/timing";
import {registry} from "@web/core/registry";
import publicWidget from "@web/legacy/js/public/public_widget";

var canvas_drawing_objects = {}, canvas_texts = {}, canvas_imgs = {}, resize_ratio = {};
import {whenReady} from "@odoo/owl";


WebsiteSale.include({

    _submitForm: function () {
        if (this.$form.find('input[name^="print_on_demand"]')) {
            var formvals = {};
            $('input[name^="print_on_demand"]').each(input => {
                var $input = $(this);
                formvals[`${$input.attr('name')}`] = $input.val();
            })
            $.extend(this.rootProduct, formvals);
        }
        return this._super.apply(this, arguments);
    }
});

export const printOnDemand = {

    start() {

        whenReady(() => {

            $('#customize-link').click(ev => {
                var pid = $(ev.currentTarget).closest('form').find('input[name="product_id"]').val();
                window.location.href = '/custom/design/' + pid.toString();
            });


            const fabricCanvases = {};
            const sizeQuantities = {};
            const undoStack = {};
            const redoStack = {};

            const sidebarItems = document.querySelectorAll(".sidebar-item");
            const contentPanel = document.querySelector(".content-panel");
            const customAreas = document.querySelectorAll("[data-area-id]"); // Get all custom areas

            console.log("Sidebar items found:", sidebarItems.length);
            console.log("Content panel found:", contentPanel ? "Yes" : "No");
            console.log("Custom areas found:", customAreas.length);

            document.querySelectorAll('.wk_canvas').forEach(area => {
                const areaId = area.getAttribute('data-area-id');
                const canvas = document.querySelector(`#tcanvas_${areaId}`);
                if (canvas) {
                    fabricCanvases[areaId] = new fabric.Canvas(canvas);
                    undoStack[areaId] = [];
                    redoStack[areaId] = [];

                    // Save initial state
                    saveState(areaId);

                    // Listen for changes to save state
                    fabricCanvases[areaId].on('object:added', () => saveState(areaId));
                    fabricCanvases[areaId].on('object:removed', () => saveState(areaId));
                    fabricCanvases[areaId].on('object:modified', () => saveState(areaId));

                    console.log(`Initialized canvas for area ${areaId}`);

                    fabricCanvases[areaId].on('object:selected', function (e) {
                        console.log('Object selected:', e.target.type);

                        document.addEventListener('keydown', handleKeyDown);
                    });

                    fabricCanvases[areaId].on('selection:cleared', function () {
                        document.removeEventListener('keydown', handleKeyDown);
                    });
                }
            });

            function handleKeyDown(e) {
                if ((e.key === 'Delete' || e.key === 'Backspace') && activeAreaId) {
                    const canvas = fabricCanvases[activeAreaId];
                    if (canvas && canvas.getActiveObjects()) {
                        canvas.getActiveObjects().forEach(obj => {
                            canvas.remove(obj);
                        });
                        canvas.discardActiveObject();
                        canvas.renderAll();
                    }
                }
            }

            function getContentTemplates(activeAreaId) {
                return {
                    product: `
            <h5 class="mb-3">SELECT Quantity</h5>
            <div class="scrollable-content">
                <div class="printing-type-select mb-3">
                    <label for="printing-type-${activeAreaId}">Printing Type:</label>
                    <select class="form-control printing-type-dropdown" id="printing-type-${activeAreaId}">
                        <option value="">Select a printing type</option>
                        <!-- Printing types will be populated via JavaScript -->
                    </select>
                </div>
                <div class="size-quantity">
                    <div class="size-row">
                        <div class="size-label">S</div>
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-size="S">-</button>
                            <input type="text" class="quantity-input" value="${sizeQuantities['S'] || 0}" data-size="S" readonly>
                            <button class="quantity-btn increase" data-size="S">+</button>
                        </div>
                    </div>
                    <div class="size-row">
                        <div class="size-label">M</div>
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-size="M">-</button>
                            <input type="text" class="quantity-input" value="${sizeQuantities['M'] || 0}" data-size="M" readonly>
                            <button class="quantity-btn increase" data-size="M">+</button>
                        </div>
                    </div>
                    <div class="size-row">
                        <div class="size-label">L</div>
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-size="L">-</button>
                            <input type="text" class="quantity-input" value="${sizeQuantities['L'] || 0}" data-size="L" readonly>
                            <button class="quantity-btn increase" data-size="L">+</button>
                        </div>
                    </div>
                    <div class="size-row">
                        <div class="size-label">XL</div>
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-size="XL">-</button>
                            <input type="text" class="quantity-input" value="${sizeQuantities['XL'] || 0}" data-size="XL" readonly>
                            <button class="quantity-btn increase" data-size="XL">+</button>
                        </div>
                    </div>
                    <div class="size-row">
                        <div class="size-label">XXL</div>
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-size="XXL">-</button>
                            <input type="text" class="quantity-input" value="${sizeQuantities['XXL'] || 0}" data-size="XXL" readonly>
                            <button class="quantity-btn increase" data-size="XXL">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `,
                    layers: `
            <h5 class="mb-3">MANAGE LAYERS</h5>
            <div class="scrollable-content">
                <ul class="layer-list list-group" id="layer-list-${activeAreaId}">
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        No objects found
                    </li>
                </ul>
                
                <div class="mt-3">
                    <button class="btn btn-outline-danger w-100 remove-selected-btn">
                        <i class="fa fa-trash mr-2"></i> Remove Selected Object
                    </button>
                </div>
            </div>
        `,
                    upload: `
            <h5 class="mb-3">UPLOAD IMAGE</h5>
            <div class="mb-3">
                <div class="row">
                    <div class="col-12">
                        <label class="btn btn-link mb-2 w-100 text-left" for="img-name-${activeAreaId}">
                            <i class="fa fa-upload mr-2"></i>
                            Upload image
                        </label>
                        <input class="add-img d-none" type="file" id="img-name-${activeAreaId}" />
                        <div class="img-name mt-2"></div>
                    </div>
                    <div class="col-12 mt-2">
                        <button class="btn btn-primary w-100 add-image-btn">Add to Design</button>
                        <button class="btn btn-outline-danger w-100 mt-2 rm-img">
                            <i class="fa fa-trash mr-2"></i> Remove Selected Image
                        </button>
                    </div>
                </div>
            </div>
        `,
                    text: `
            <h5 class="mb-3">ADD TEXT</h5>
            <div class="mb-3">
                <textarea class="form-control text-input" rows="3" placeholder="Enter your text"></textarea>
                
                <div class="font-preview-grid mt-3">
                    <h6 class="w-100">Choose a Style:</h6>

                    <div class="color-palette mb-3">
                        <h6 class="text-muted">Colors:</h6>
                        <div class="color-options">
                            <div class="color-option" data-color="#000000" style="background-color: #000000"></div>
                            <div class="color-option" data-color="#e74c3c" style="background-color: #e74c3c"></div>
                            <div class="color-option" data-color="#3498db" style="background-color: #3498db"></div>
                            <div class="color-option" data-color="#2ecc71" style="background-color: #2ecc71"></div>
                            <div class="color-option" data-color="#f1c40f" style="background-color: #f1c40f"></div>
                            <div class="color-option" data-color="#9b59b6" style="background-color: #9b59b6"></div>
                            <div class="color-option" data-color="#e67e22" style="background-color: #e67e22"></div>
                            <div class="color-option" data-color="#1abc9c" style="background-color: #1abc9c"></div>
                            <div class="color-option custom-color" data-color="custom">
                                <i class="fa fa-plus"></i>
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <!-- Row 1 -->
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Arial" data-font-weight="400" data-color="#000000" data-spacing="0">
                                <div class="font-preview-content" style="font-family: Arial; font-weight: 400; color: #000000; letter-spacing: 0;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Times New Roman" data-font-weight="400" data-color="#3498db" data-spacing="0">
                                <div class="font-preview-content" style="font-family: 'Times New Roman'; font-weight: 400; color: #3498db; letter-spacing: 0;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Courier New" data-font-weight="400" data-color="#e74c3c" data-spacing="1">
                                <div class="font-preview-content" style="font-family: 'Courier New'; font-weight: 400; color: #e74c3c; letter-spacing: 1px;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Row 2 -->
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Arial" data-font-weight="700" data-color="#2ecc71" data-spacing="0">
                                <div class="font-preview-content" style="font-family: Arial; font-weight: 700; color: #2ecc71; letter-spacing: 0;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Georgia" data-font-weight="400" data-color="#f1c40f" data-spacing="0">
                                <div class="font-preview-content" style="font-family: Georgia; font-weight: 400; color: #f1c40f; letter-spacing: 0;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="font-preview-card" data-font-family="Verdana" data-font-weight="600" data-color="#9b59b6" data-spacing="0.5">
                                <div class="font-preview-content" style="font-family: Verdana; font-weight: 600; color: #9b59b6; letter-spacing: 0.5px;">
                                    <div>Your text</div>
                                    <div>here</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-6">
                        <select class="form-control font-family">
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <select class="form-control font-size">
                            <option value="12">12px</option>
                            <option value="14">14px</option>
                            <option value="18">18px</option>
                            <option value="24">24px</option>
                            <option value="32">32px</option>
                        </select>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <input type="color" class="form-control color-picker" value="#000000">
                    </div>
                </div>
                <button class="btn btn-primary w-100 mt-3 add-text-btn">Add Text</button>
                <button class="btn btn-outline-danger w-100 mt-3 remove-text-btn">
                    <i class="fa fa-trash mr-2"></i> Remove Selected Text
                </button>
            </div>
            
          
        `,
                };
            }

            let activeAreaId = null;

            document.querySelectorAll('.wk_canvas.active').forEach(area => {
                activeAreaId = area.getAttribute('data-area-id');
                console.log("Initial active area ID:", activeAreaId);
            });

            document.querySelectorAll('.wk-img').forEach(tab => {
                tab.addEventListener('click', function () {
                    activeAreaId = this.getAttribute('data-area-id');
                    console.log("Switched to custom area:", activeAreaId);

                    const activeMenuItem = document.querySelector('.sidebar-item.active-item');
                    if (activeMenuItem) {
                        const itemType = activeMenuItem.getAttribute('data-panel-type');
                        updatePanel(itemType);
                    }
                });
            });

            sidebarItems.forEach((item) => {
                console.log("Adding event listener to:", item);
                item.addEventListener("click", function () {
                    const itemType = this.getAttribute("data-panel-type");
                    console.log("Clicked item type:", itemType);
                    updatePanel(itemType);
                });
            });

            function updatePanel(itemType) {
                sidebarItems.forEach((si) => si.classList.remove("active-item"));
                document.querySelector(`[data-panel-type="${itemType}"]`)?.classList.add("active-item");
                const templates = getContentTemplates(activeAreaId);

                if (templates[itemType]) {
                    console.log("Updating panel with content for:", itemType, "area:", activeAreaId);
                    contentPanel.innerHTML = templates[itemType];
                    if (itemType === 'layers') {
                        updateLayersPanel();
                    }
                    attachEventListeners(itemType);
                }
            }

            function updateLayersPanel() {
                const layerList = document.getElementById(`layer-list-${activeAreaId}`);
                if (!layerList || !fabricCanvases[activeAreaId]) return;

                const canvas = fabricCanvases[activeAreaId];
                const objects = canvas.getObjects();

                if (objects.length === 0) {
                    layerList.innerHTML = `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                No objects found
            </li>
        `;
                    return;
                }

                layerList.innerHTML = '';
                objects.forEach((obj, index) => {
                    const type = obj.type === 'image' ? 'Image' : 'Text';
                    const content = obj.type === 'image' ? 'Image' : obj.text.substring(0, 15) + (obj.text.length > 15 ? '...' : '');

                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
            <span>${type}: ${content}</span>
            <div>
                <button class="btn btn-sm btn-outline-danger delete-object" data-index="${index}">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        `;
                    layerList.appendChild(li);
                });

                document.querySelectorAll('.delete-object').forEach(btn => {
                    btn.addEventListener('click', function () {
                        const index = parseInt(this.getAttribute('data-index'));
                        const objectToRemove = canvas.getObjects()[index];
                        if (objectToRemove) {
                            canvas.remove(objectToRemove);
                            canvas.renderAll();
                            updateLayersPanel(); // Refresh the layers panel
                        }
                    });
                });
            }

            function attachEventListeners(itemType) {
                if (itemType === 'product') {
                    loadPrintingTypes();

                    // Add printing type change event listener
                    const printingTypeDropdown = document.querySelector(`#printing-type-${activeAreaId}`);
                    if (printingTypeDropdown) {
                        printingTypeDropdown.addEventListener('change', function () {
                            const printingTypeId = this.value;
                            // Store selected printing type
                            sessionStorage.setItem('selected_printing_type_id', printingTypeId);
                            console.log('Selected printing type:', printingTypeId);
                        });
                    }
                    const increaseButtons = document.querySelectorAll('.quantity-btn.increase');
                    const decreaseButtons = document.querySelectorAll('.quantity-btn.decrease');

                    increaseButtons.forEach(button => {
                        button.addEventListener('click', function () {
                            const size = this.getAttribute('data-size');
                            const input = this.parentElement.querySelector('.quantity-input');
                            let value = parseInt(input.value) || 0;
                            value = value + 1;
                            input.value = value;

                            // Save the updated quantity to our global object
                            sizeQuantities[size] = value;
                            console.log('Increased size:', size, 'to', value);
                            console.log('Current quantities:', sizeQuantities);
                        });
                    });

                    decreaseButtons.forEach(button => {
                        button.addEventListener('click', function () {
                            const size = this.getAttribute('data-size');
                            const input = this.parentElement.querySelector('.quantity-input');
                            let value = parseInt(input.value) || 0;
                            if (value > 0) {
                                value = value - 1;
                                input.value = value;

                                // Save the updated quantity to our global object
                                sizeQuantities[size] = value;
                                console.log('Decreased size:', size, 'to', value);
                                console.log('Current quantities:', sizeQuantities);
                            }
                        });
                    });
                } else if (itemType === 'upload') {
                    const fileInput = document.querySelector(`#img-name-${activeAreaId}`);
                    const imgNameDiv = document.querySelector('.img-name');
                    const removeBtn = document.querySelector('.rm-img');
                    const addImageBtn = document.querySelector('.add-image-btn');

                    if (fileInput) {
                        fileInput.addEventListener('change', function () {
                            if (this.files && this.files[0]) {
                                const fileName = this.files[0].name;
                                imgNameDiv.textContent = fileName;
                                fileInput.fileToAdd = this.files[0];
                            }
                        });
                    }

                    if (addImageBtn) {
                        addImageBtn.addEventListener('click', function () {
                            if (fileInput && fileInput.fileToAdd) {
                                const reader = new FileReader();
                                reader.onload = function (e) {
                                    addImageToCanvas(e.target.result);
                                };
                                reader.readAsDataURL(fileInput.fileToAdd);
                            }
                        });
                    }

                    if (removeBtn) {
                        removeBtn.addEventListener('click', function () {
                            const canvas = fabricCanvases[activeAreaId];
                            if (canvas) {
                                const activeObject = canvas.getActiveObject();
                                if (activeObject && activeObject.type === 'image') {
                                    canvas.remove(activeObject);
                                    canvas.renderAll();
                                } else {
                                    alert('Please select an image to remove');
                                }
                            }
                        });
                    }
                } else if (itemType === 'text') {
                    document.querySelectorAll('.color-option').forEach(colorOption => {
                        colorOption.addEventListener('click', function () {
                            const colorValue = this.getAttribute('data-color');
                            if (colorValue === 'custom') {
                                document.querySelector('.color-picker').click();
                                return;
                            }

                            document.querySelectorAll('.color-option').forEach(option => {
                                option.classList.remove('selected');
                            });

                            this.classList.add('selected');

                            document.querySelector('.color-picker').value = colorValue;

                            updateFontPreviewCardsColor(colorValue);
                        });
                    });

                    const colorPicker = document.querySelector('.color-picker');
                    if (colorPicker) {
                        colorPicker.addEventListener('input', function () {
                            const newColor = this.value;

                            document.querySelectorAll('.color-option').forEach(option => {
                                option.classList.remove('selected');
                            });

                            const matchingOption = document.querySelector(`.color-option[data-color="${newColor}"]`);
                            if (matchingOption) {
                                matchingOption.classList.add('selected');
                            }
                            updateFontPreviewCardsColor(newColor);
                        });
                    }

                    document.querySelectorAll('.font-preview-card').forEach(card => {
                        card.addEventListener('click', function () {
                            document.querySelectorAll('.font-preview-card').forEach(c => {
                                c.classList.remove('selected');
                            });

                            this.classList.add('selected');

                            const fontFamily = this.getAttribute('data-font-family');
                            const fontWeight = this.getAttribute('data-font-weight');
                            const color = this.getAttribute('data-color');
                            const spacing = this.getAttribute('data-spacing');

                            document.querySelector('.font-family').value = fontFamily;
                            document.querySelector('.color-picker').value = color;

                            document.querySelectorAll('.color-option').forEach(option => {
                                option.classList.remove('selected');
                            });

                            const matchingColorOption = document.querySelector(`.color-option[data-color="${color}"]`);
                            if (matchingColorOption) {
                                matchingColorOption.classList.add('selected');
                            }

                            let fontSize = 18; // default
                            if (fontWeight >= 700) {
                                fontSize = 24;
                            } else if (fontWeight >= 600) {
                                fontSize = 20;
                            }
                            document.querySelector('.font-size').value = fontSize;
                        });
                    });

                    const addTextBtn = document.querySelector('.add-text-btn');
                    const removeTextBtn = document.querySelector('.remove-text-btn');

                    if (addTextBtn) {
                        addTextBtn.addEventListener('click', function () {
                            const textContent = document.querySelector('.text-input').value;
                            const fontFamily = document.querySelector('.font-family').value;
                            const fontSize = document.querySelector('.font-size').value;
                            const textColor = document.querySelector('.color-picker').value;

                            if (textContent.trim() !== "") {
                                addTextToCanvas(textContent, fontFamily, fontSize, textColor);
                            }
                        });
                    }

                    if (removeTextBtn) {
                        removeTextBtn.addEventListener('click', function () {
                            const canvas = fabricCanvases[activeAreaId];
                            if (canvas) {
                                const activeObject = canvas.getActiveObject();
                                if (activeObject && activeObject.type === 'text') {
                                    canvas.remove(activeObject);
                                    canvas.renderAll();
                                } else {
                                    alert('Please select a text element to remove');
                                }
                            }
                        });
                    }
                } else if (itemType === 'layers') {
                    const removeSelectedBtn = document.querySelector('.remove-selected-btn');
                    if (removeSelectedBtn) {
                        removeSelectedBtn.addEventListener('click', function () {
                            const canvas = fabricCanvases[activeAreaId];
                            if (canvas) {
                                const activeObject = canvas.getActiveObject();
                                if (activeObject) {
                                    canvas.remove(activeObject);
                                    canvas.renderAll();
                                    updateLayersPanel(); // Refresh the panel
                                } else {
                                    alert('Please select an object to remove');
                                }
                            }
                        });
                    }
                }
            }

            function loadPrintingTypes() {
                console.log('Calling /shop/printing_types');
                const dropdown = document.querySelector(`#printing-type-${activeAreaId}`);
                if (!dropdown) return;

                dropdown.innerHTML = '<option value="">Select a printing type</option>';

                // Using fetch instead of odoo.jsonRpc
                fetch('/shop/printing_types', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '',
                    },
                    body: JSON.stringify({})
                })
                    .then(response => response.json())
                    .then(function (result) {
                        console.log('Result from /shop/printing_types: --------------------', result);
                        if (result && result.length) {
                            result.forEach(function (printingType) {
                                const option = document.createElement('option');
                                option.value = printingType.id;
                                option.textContent = printingType.name;
                                dropdown.appendChild(option);
                            });
                        }
                    })
                    .catch(function (error) {
                        console.error('Error calling /shop/printing_types:', error);
                    });
            }

            function updateFontPreviewCardsColor(color) {
                document.querySelectorAll('.font-preview-card').forEach(card => {
                    const previewContent = card.querySelector('.font-preview-content');
                    previewContent.style.color = color;
                    card.setAttribute('data-color', color);
                });
            }

            function addImageToCanvas(imageData) {
                console.log("Adding image to canvas for area:", activeAreaId);

                if (!fabricCanvases[activeAreaId]) {
                    console.error("No fabric canvas found for area:", activeAreaId);
                    return;
                }

                fabric.Image.fromURL(imageData, function (img) {
                    // Scale image to fit within canvas
                    const canvas = fabricCanvases[activeAreaId];
                    const canvasWidth = canvas.getWidth();
                    const canvasHeight = canvas.getHeight();

                    if (img.width > canvasWidth || img.height > canvasHeight) {
                        const scale = Math.min(
                            canvasWidth / img.width,
                            canvasHeight / img.height
                        ) * 0.8; // 80% of max size

                        img.scale(scale);
                    }

                    img.set({
                        left: canvasWidth / 2,
                        top: canvasHeight / 2,
                        originX: 'center',
                        originY: 'center'
                    });

                    img.set({
                        selectable: true,
                        hasControls: true,
                        hasBorders: true
                    });

                    canvas.add(img);
                    canvas.setActiveObject(img); // Select the new image
                    canvas.renderAll();
                    if (document.querySelector('.sidebar-item[data-panel-type="layers"].active-item')) {
                        updateLayersPanel();
                    }
                });
            }

            function addTextToCanvas(text, fontFamily, fontSize, textColor) {
                console.log("Adding text:", text, "Font:", fontFamily, "Size:", fontSize, "Color:", textColor, "to area:", activeAreaId);

                if (!fabricCanvases[activeAreaId]) {
                    console.error("No fabric canvas found for area:", activeAreaId);
                    return;
                }

                const canvas = fabricCanvases[activeAreaId];
                const canvasWidth = canvas.getWidth();
                const canvasHeight = canvas.getHeight();

                const textObj = new fabric.Text(text, {
                    fontFamily: fontFamily,
                    fontSize: parseInt(fontSize),
                    fill: textColor || "#000000",
                    left: canvasWidth / 2,
                    top: canvasHeight / 2,
                    originX: 'center',
                    originY: 'center',
                    selectable: true,
                    hasControls: true,
                    hasBorders: true
                });

                canvas.add(textObj);
                canvas.setActiveObject(textObj);
                canvas.renderAll();

                if (document.querySelector('.sidebar-item[data-panel-type="layers"].active-item')) {
                    updateLayersPanel();
                }
            }

            // Save the current state to the undo stack
            function saveState(areaId) {
                const canvas = fabricCanvases[areaId];
                if (!canvas) {
                    console.error('saveState: No canvas found for area', areaId);
                    return;
                }

                // Serialize the current state
                const currentState = canvas.toJSON();
                console.debug(`saveState: Creating state for area ${areaId}`);

                // Only save if the state is different from the last saved state
                const lastState = undoStack[areaId]?.length > 0 ?
                    undoStack[areaId][undoStack[areaId].length - 1] : null;

                const isDifferent = !lastState ||
                    JSON.stringify(currentState) !== JSON.stringify(lastState);

                if (isDifferent) {
                    console.debug(`saveState: State is different, saving to undoStack for area ${areaId}`);

                    // Push current state to undo stack
                    undoStack[areaId].push(currentState);

                    // Limit the undo stack size to prevent memory issues
                    if (undoStack[areaId].length > 20) {
                        undoStack[areaId].shift();
                    }

                    // IMPORTANT: Only clear redo stack when a new state is created
                    // NOT when we're restoring from undo/redo
                    if (!canvas.isRestoringState) {
                        console.debug(`saveState: Clearing redoStack for area ${areaId}`);
                        redoStack[areaId] = [];
                    }

                    console.log(`State saved for area ${areaId}. Undo Stack: ${undoStack[areaId].length}, Redo Stack: ${redoStack[areaId].length}`);
                } else {
                    console.debug(`saveState: State is identical, not saving for area ${areaId}`);
                }
            }

            function undo(areaId) {
                console.debug(`undo: Called for area ${areaId}`);

                const canvas = fabricCanvases[areaId];
                if (!canvas) {
                    console.error(`undo: No canvas found for area ${areaId}`);
                    return;
                }

                if (!undoStack[areaId] || undoStack[areaId].length <= 1) {
                    console.log(`undo: Nothing to undo for area ${areaId}. Stack size: ${undoStack[areaId]?.length || 0}`);
                    return;
                }

                // Save current state to redo stack before undoing
                const currentState = undoStack[areaId].pop();
                console.debug(`undo: Popped state from undoStack for area ${areaId}`);

                // Initialize redoStack if it doesn't exist
                if (!redoStack[areaId]) {
                    redoStack[areaId] = [];
                }

                redoStack[areaId].push(currentState);
                console.debug(`undo: Pushed state to redoStack for area ${areaId}. redoStack size now: ${redoStack[areaId].length}`);

                // Restore the previous state
                const previousState = undoStack[areaId][undoStack[areaId].length - 1];

                // Flag to prevent saveState from clearing redoStack
                canvas.isRestoringState = true;

                canvas.loadFromJSON(previousState, () => {
                    canvas.renderAll();
                    // Remove the flag after state is restored
                    canvas.isRestoringState = false;
                    console.log(`Undo performed for area ${areaId}. Undo Stack: ${undoStack[areaId].length}, Redo Stack: ${redoStack[areaId].length}`);
                });
            }


            function redo(areaId) {
                console.debug(`redo: Called for area ${areaId}`);

                const canvas = fabricCanvases[areaId];
                if (!canvas) {
                    console.error(`redo: No canvas found for area ${areaId}`);
                    return;
                }

                if (!redoStack[areaId] || redoStack[areaId].length === 0) {
                    console.log(`redo: Nothing to redo for area ${areaId}. Stack size: ${redoStack[areaId]?.length || 0}`);
                    return;
                }

                // Get the state to redo
                const stateToRedo = redoStack[areaId].pop();


                console.debug(`redo: Popped state from redoStack for area ${areaId}. redoStack size now: ${redoStack[areaId].length}`);

                // Flag to prevent saveState from clearing redoStack
                canvas.isRestoringState = true;

                // Apply the redone state
                canvas.loadFromJSON(stateToRedo, () => {
                    // After successful load, add this state to the undo stack
                    undoStack[areaId].push(stateToRedo);
                    console.debug(`redo: Pushed state to undoStack for area ${areaId}`);

                    canvas.renderAll();
                    // Remove the flag after state is restored
                    canvas.isRestoringState = false;

                    console.log(`Redo performed for area ${areaId}. Undo Stack: ${undoStack[areaId].length}, Redo Stack: ${redoStack[areaId].length}`);
                });
            }

            document.querySelector('.editor-tool[title="Undo"]').addEventListener('click', () => {
                if (activeAreaId) {
                    console.log('Undo button clicked.');
                    undo(activeAreaId);
                }
            });

            document.querySelector('.editor-tool[title="Redo"]').addEventListener('click', () => {
                if (activeAreaId) {
                    console.log('Redo button clicked.');
                    redo(activeAreaId);
                }
            });

            updatePanel("product");


            document.getElementById('add-to-cart').addEventListener('click', function () {
                // Use the quantities from our global object
                let totalQuantity = 0;
                const quantities = {};

                // Process our saved quantities
                Object.keys(sizeQuantities).forEach(size => {
                    const quantity = sizeQuantities[size] || 0;
                    if (quantity > 0) {
                        quantities[size] = quantity;
                        totalQuantity += quantity;
                    }
                });

                console.log('Quantities object:', quantities);
                console.log('Total quantity:', totalQuantity);

                // Check if at least one size has a quantity
                if (totalQuantity === 0) {
                    alert('Please select at least one size and quantity');
                    return;
                }

                // Collect design data from all custom areas
                const designData = {};
                Object.keys(fabricCanvases).forEach(areaId => {
                    const canvas = fabricCanvases[areaId];
                    if (canvas) {
                        // Convert canvas to JSON for storage
                        designData[areaId] = canvas.toJSON();
                    }
                });

                // Create a form to submit the data
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/shop/cart/update';

                // Add product_id field
                const productIdInput = document.createElement('input');
                productIdInput.type = 'hidden';
                productIdInput.name = 'product_id';
                // Extract product ID from URL or data attribute
                const productId = getProductId();
                productIdInput.value = productId;
                form.appendChild(productIdInput);

                // Add quantity field (total quantity)
                const quantityInput = document.createElement('input');
                quantityInput.type = 'hidden';
                quantityInput.name = 'add_qty';
                quantityInput.value = totalQuantity;
                form.appendChild(quantityInput);

                // Add custom_design field to store design data
                const customDesignInput = document.createElement('input');
                customDesignInput.type = 'hidden';
                customDesignInput.name = 'custom_design';
                customDesignInput.value = JSON.stringify({
                    quantities: quantities,
                    design: designData
                });
                form.appendChild(customDesignInput);

                // Add CSRF token if needed
                if (window.csrf_token) {
                    const csrfInput = document.createElement('input');
                    csrfInput.type = 'hidden';
                    csrfInput.name = 'csrf_token';
                    csrfInput.value = window.csrf_token;
                    form.appendChild(csrfInput);
                }

                // Submit the form
                document.body.appendChild(form);
                form.submit();
            });
            document.getElementById('preview-design')?.addEventListener('click', function () {
                alert('Preview functionality is not yet implemented');
            });

            function getProductId() {

                const pathParts = window.location.pathname.split('/');
                if (pathParts.includes('custom') && pathParts.includes('design')) {
                    const designIndex = pathParts.indexOf('design');
                    if (designIndex !== -1 && pathParts.length > designIndex + 1) {
                        const productId = pathParts[designIndex + 1];
                        if (productId && !isNaN(productId)) {
                            return productId;
                        }
                    }
                }

                const hiddenProductInput = document.querySelector('input[name="product_id"]');
                if (hiddenProductInput && hiddenProductInput.value) {
                    return hiddenProductInput.value;
                }

                const bodyProductId = document.body.getAttribute('data-product-id');
                if (bodyProductId) {
                    return bodyProductId;
                }

                console.error('Could not determine product ID');
                alert('Could not determine product ID. Please select a product first.');
                return '';
            }


        });

        // return canvas_drawing_objects

    },

    canvas_drawing_objects: canvas_drawing_objects,

};

registry.category("services").add("print_on_demand", printOnDemand);


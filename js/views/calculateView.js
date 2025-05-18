/*
  Arquivo: calculateView.js
  Descrição: Este módulo gerencia a funcionalidade da "Página de Cálculo de Lucro".
  Ele é responsável por carregar a lista de itens craftáveis, permitir a busca por itens
  (incluindo busca por materiais que compõem os itens), exibir os itens em cards interativos,
  e abrir um modal detalhado para que o usuário insira preços de mercado e quantidades
  para calcular o custo de produção e o lucro potencial.
  Principais Funções:
  - initCalculateView: Inicializa a view, busca os elementos DOM necessários, anexa listeners de evento
                       (para pesquisa, botões de calcular, modal).
  - loadItemsForCalculation: Busca todos os itens da API e dispara a renderização inicial.
  - renderCalculateItemList: Cria e exibe os cards dos itens na página. Destaca cards se a pesquisa
                             corresponder a um de seus materiais. Implementa preview de materiais no hover do card.
  - renderMaterialsPreview: Mostra uma lista de materiais de um item quando o mouse passa sobre o card.
  - prepareAndOpenCalculateModal: Busca os dados detalhados de um item e abre o modal de cálculo.
  - openCalculationModal: Preenche o modal com os dados da receita selecionada, permitindo ao usuário
                          inserir preços de mercado, quantidade de packs e custos de profissão (se aplicável).
  - closeCalculationModal: Fecha o modal de cálculo.
  - updateDynamicModalValues: Atualiza dinamicamente os campos no modal (total de itens, quantidades de material)
                              conforme o usuário altera a quantidade de packs a fabricar.
  - handleModalConfirm: Valida os inputs do modal, calcula o custo e o lucro usando o módulo 'calculator.js',
                        e exibe os resultados no modal. Também valida as quantidades de lotes.
  - displayModalResults: Formata e exibe os resultados do cálculo (custo, receitas, lucros, percentuais) no modal.
  - filterItems: Filtra a lista de itens exibida com base no termo de pesquisa inserido pelo usuário.
                 Prioriza correspondências diretas no nome do item sobre correspondências em nomes de materiais.
  - addPriceQtyPair: Adiciona dinamicamente campos para inserir preço e quantidade de um lote de material no modal.
  - validateAndUpdateLotInputs: Valida se a soma das quantidades dos lotes de um material corresponde ao total
                                necessário, aplicando classes CSS para feedback visual.
  Módulos Importados:
  - api (apiService.js): Para buscar dados de itens e receitas.
  - ui (ui.js): Para interações com a UI, como exibir mensagens de status.
  - calculator (calculator.js): Para realizar os cálculos de custo e lucro.
*/
import * as api from '../apiService.js';
import * as ui from '../ui.js';
import * as calculator from '../calculator.js';

const elements = {
    calculateItemList: 'calculate-item-list',
    calculateLoadingMsg: 'calculate-loading-message',
    calculationModal: 'calculation-modal',
    modalCloseButton: 'modal-close-button',
    modalConfirmButton: 'modal-confirm-button',
    modalItemNameSpan: 'modal-item-name',
    modalCraftQuantityInput: 'modal-craft-quantity',
    modalTotalItemsLabel: 'modal-total-items-label',
    modalMaterialsList: 'modal-materials-list',
    modalSellPriceMarketInput: 'modal-sell-price-market',
    modalSellPriceNpcBaseSpan: 'modal-sell-price-npc-base',
    modalSellPriceNpcTotalSpan: 'modal-sell-price-npc-total',
    modalCalcPacksLabelNpc: 'modal-calc-packs-label-npc',
    modalResultsDiv: 'modal-results',
    modalCalcPacksLabelResults: 'modal-calc-packs-label-results',
    modalResultCost: 'modal-result-cost',
    modalResultRevenueMarket: 'modal-result-revenue-market',
    modalResultRevenueNpc: 'modal-result-revenue-npc',
    modalResultProfitMarket: 'modal-result-profit-market',
    modalResultProfitNpc: 'modal-result-profit-npc',
    modalCompensaMarket: 'modal-compensa-market',
    modalCompensaNpc: 'modal-compensa-npc',
    modalProfitPercentageMarket: 'modal-profit-percentage-market',
    modalProfitPerProfMatLine: 'modal-result-profit-per-prof-mat-line',
    modalProfitPerProfMatValue: 'modal-result-profit-per-prof-mat',
    profMatNameSpan: '.prof-mat-name',
    modalStatus: 'modal-status',
    calculateStatus: 'calculate-status',
    calculateItemSearch: 'calculate-item-search'
};

let domElements = {};
let currentRecipeData = null;
let allItems = [];
let activeCardExpanded = null;

function validateAndUpdateLotInputs(materialLiElement) {
    if (!materialLiElement) return;
    const totalNeededString = materialLiElement.dataset.totalNeeded;
    const totalMaterialNeeded = parseInt(totalNeededString, 10);
    const qtyInputs = materialLiElement.querySelectorAll('.market-qty-input');
    if (qtyInputs.length === 0 || isNaN(totalMaterialNeeded)) {
        qtyInputs.forEach(input => { input.classList.remove('input-valid', 'input-invalid', 'input-warning'); });
        return;
    }
    let sumOfLotQuantities = 0;
    qtyInputs.forEach(input => { sumOfLotQuantities += parseInt(input.value, 10) || 0; });
    let stateClass = '';
    if (sumOfLotQuantities === totalMaterialNeeded) { stateClass = 'input-valid'; }
    else if (sumOfLotQuantities < totalMaterialNeeded && sumOfLotQuantities >= 0) { stateClass = 'input-warning'; }
    else { stateClass = 'input-invalid'; }
    qtyInputs.forEach(input => {
        input.classList.remove('input-valid', 'input-invalid', 'input-warning');
        if (stateClass) { input.classList.add(stateClass); }
    });
}

export function initCalculateView() {
    console.log("[calculateView] Inicializando...");
    domElements = Object.keys(elements).reduce((acc, key) => { if (key !== 'profMatNameSpan') { acc[key] = document.getElementById(elements[key]); } return acc; }, {});
    const essentialElementIds = Object.keys(elements).filter(key => key !== 'profMatNameSpan');
    const missingElement = essentialElementIds.find(key => !domElements[key]);
    if (missingElement) { console.error(`[calculateView] ERRO FATAL: Elemento não encontrado: #${elements[missingElement]}`); if(domElements.calculateStatus) { ui.showStatusMessage(elements.calculateStatus, `Erro: Falha ao carregar UI (${elements[missingElement]}).`, "error"); } return; }
    console.log("[calculateView] Todos elementos essenciais encontrados.");
    try {
        const oldClose = domElements.modalCloseButton; const newClose = oldClose.cloneNode(true); oldClose.parentNode.replaceChild(newClose, oldClose); domElements.modalCloseButton = newClose;
        const oldConfirm = domElements.modalConfirmButton; const newConfirm = oldConfirm.cloneNode(true); oldConfirm.parentNode.replaceChild(newConfirm, oldConfirm); domElements.modalConfirmButton = newConfirm;
        const oldQtyInput = domElements.modalCraftQuantityInput; const newQtyInput = oldQtyInput.cloneNode(true); oldQtyInput.parentNode.replaceChild(newQtyInput, oldQtyInput); domElements.modalCraftQuantityInput = newQtyInput;

        if (domElements.modalMaterialsList && typeof domElements.modalMaterialsList._eventListenerInput === 'function') {
             domElements.modalMaterialsList.removeEventListener('input', domElements.modalMaterialsList._eventListenerInput);
             domElements.modalMaterialsList._eventListenerInput = null;
             console.log("[calculateView] Listener 'input' da lista de materiais removido.");
        }

        domElements.modalCloseButton.addEventListener('click', closeCalculationModal);
        domElements.modalConfirmButton.addEventListener('click', handleModalConfirm);
        domElements.modalCraftQuantityInput.addEventListener('input', updateDynamicModalValues);

        const inputHandler = (event) => {
             if (event.target.classList.contains('market-qty-input') || event.target.classList.contains('market-price-input')) {
                 const li = event.target.closest('li');
                 if (li) validateAndUpdateLotInputs(li);
             }
        };
        domElements.modalMaterialsList.addEventListener('input', inputHandler);
        domElements.modalMaterialsList._eventListenerInput = inputHandler;
        console.log("[calculateView] Listeners do modal re-anexados.");

    } catch(e) { console.error("[calculateView] Erro ao gerenciar listeners do modal:", e); }

    if (domElements.calculateItemSearch) {
        domElements.calculateItemSearch.addEventListener('input', () => filterItems(domElements.calculateItemSearch.value));
    }

    loadItemsForCalculation();
}

async function loadItemsForCalculation() {
    if (domElements.calculateLoadingMsg) domElements.calculateLoadingMsg.style.display = 'block';
    if (domElements.calculateItemList) domElements.calculateItemList.innerHTML = '';
    ui.hideStatusMessage(elements.calculateStatus);
    try {
        const items = await api.fetchItems();
        allItems = items;
        filterItems(domElements.calculateItemSearch ? domElements.calculateItemSearch.value : '');
        if (domElements.calculateLoadingMsg) domElements.calculateLoadingMsg.style.display = 'none';
        if (!items || items.length === 0) {
            ui.showStatusMessage(elements.calculateStatus, "Nenhum item registrado.", "info");
        }
    } catch (error) {
        console.error("Erro ao carregar itens para cálculo:", error);
        if (domElements.calculateLoadingMsg) domElements.calculateLoadingMsg.textContent = 'Erro ao carregar itens.';
        ui.showStatusMessage(elements.calculateStatus, `Erro ao carregar itens: ${error.message || 'Verifique console.'}`, "error");
    }
}

function renderCalculateItemList(itemsToRender) {
    const container = domElements.calculateItemList;
    if (!container) return;
    container.innerHTML = '';

    if (!itemsToRender || itemsToRender.length === 0) {
        if (domElements.calculateItemSearch && domElements.calculateItemSearch.value) {
            container.innerHTML = '<p class="info-text">Nenhum item encontrado com o termo pesquisado.</p>';
        }
        return;
    }

    itemsToRender.forEach(itemWrapper => {
        const item = itemWrapper.item;
        const isSubItemMatch = itemWrapper.isSubItemMatch;

        const card = document.createElement('div');
        card.className = 'item-card';
        if (isSubItemMatch) {
            card.classList.add('highlight-contains-searched-material');
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-card-info';

        const nameH3 = document.createElement('h3');
        nameH3.className = 'item-card-name';
        nameH3.textContent = item.name;
        infoDiv.appendChild(nameH3);

        const detailsP = document.createElement('p');
        detailsP.className = 'item-card-details';
        const npcPriceFormatted = ui.formatCurrency ? ui.formatCurrency(item.npc_sell_price || 0) : (item.npc_sell_price || 0);
        detailsP.textContent = `Preço NPC (Pack): ${npcPriceFormatted}`;
        infoDiv.appendChild(detailsP);

        const materialsPreviewContainer = document.createElement('div');
        materialsPreviewContainer.className = 'item-card-materials-preview';
        materialsPreviewContainer.style.display = 'none';
        infoDiv.appendChild(materialsPreviewContainer);

        card.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-card-actions';
        const calcButton = document.createElement('button');
        calcButton.textContent = 'Calcular Lucro';
        calcButton.className = 'button button-primary';
        calcButton.dataset.id = item.id;
        calcButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const button = e.target;
            const originalText = button.textContent;
            button.textContent = 'Carregando...';
            button.disabled = true;
            prepareAndOpenCalculateModal(item.id).finally(() => {
                button.textContent = originalText;
                button.disabled = false;
            });
        });
        actionsDiv.appendChild(calcButton);
        card.appendChild(actionsDiv);

        card.addEventListener('mouseenter', () => {
            if (activeCardExpanded && activeCardExpanded !== card) {
                activeCardExpanded.classList.remove('item-card-expanded');
                const prevPreview = activeCardExpanded.querySelector('.item-card-materials-preview');
                if (prevPreview) prevPreview.style.display = 'none';
            }
            card.classList.add('item-card-expanded');
            materialsPreviewContainer.style.display = 'block';
            renderMaterialsPreview(materialsPreviewContainer, item.materials, item.quantity_produced);
            activeCardExpanded = card;
        });

        card.addEventListener('mouseleave', () => {
            card.classList.remove('item-card-expanded');
            materialsPreviewContainer.style.display = 'none';
            if (activeCardExpanded === card) {
                activeCardExpanded = null;
            }
        });

        container.appendChild(card);
    });
}

function renderMaterialsPreview(container, materials, quantityProduced) {
    container.innerHTML = '';
    if (!materials || materials.length === 0) {
        container.innerHTML = '<p class="no-materials-text">Esta receita não possui materiais registrados.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'materials-preview-list';

    const title = document.createElement('p');
    title.className = 'materials-preview-title';
    title.textContent = `Materiais para produzir ${quantityProduced}x:`;
    container.appendChild(title);

    materials.forEach(material => {
        const listItem = document.createElement('li');
        listItem.textContent = `${material.quantity}x ${material.material_name} (${material.material_type})`;
        list.appendChild(listItem);
    });
    container.appendChild(list);
}

async function prepareAndOpenCalculateModal(itemId) {
    ui.showStatusMessage(elements.calculateStatus, `Buscando detalhes ID: ${itemId}...`, 'loading');
    try {
        const recipeData = await api.fetchRecipe(itemId);
        if (recipeData) {
            currentRecipeData = recipeData;
            openCalculationModal();
            ui.hideStatusMessage(elements.calculateStatus);
        } else {
            ui.showStatusMessage(elements.calculateStatus, `Item ID: ${itemId} não encontrado.`, "error");
        }
    } catch (error) {
        console.error("Erro ao buscar receita para modal:", error);
        ui.showStatusMessage(elements.calculateStatus, `Erro ao buscar receita: ${error.message || 'Erro desconhecido.'}`, "error");
    }
}

function addPriceQtyPair(container, materialName, isFirstPair = false, initialQty = 1, initialPrice = 0) {
    const liParent = container.closest('li');
    const pairDiv = document.createElement('div');
    pairDiv.className = 'price-qty-pair';

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'market-price-input';
    priceInput.placeholder = 'Preço Unit.';
    priceInput.min = '0';
    priceInput.dataset.materialName = materialName;
    priceInput.value = isFirstPair ? (initialPrice || 0) : '';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'market-qty-input';
    qtyInput.placeholder = 'Qtd Lote';
    qtyInput.min = '1';
    qtyInput.dataset.materialName = materialName;
    qtyInput.value = isFirstPair ? (initialQty || 1) : '';

    pairDiv.appendChild(priceInput);
    pairDiv.appendChild(document.createTextNode(' / Lote: '));
    pairDiv.appendChild(qtyInput);

    if (!isFirstPair) {
        const removePairButton = document.createElement('button');
        removePairButton.type = 'button';
        removePairButton.textContent = 'X';
        removePairButton.className = 'button button-danger remove-pair-button button-xsmall';
        removePairButton.title = 'Remover este lote';
        removePairButton.addEventListener('click', () => {
            const liForValidation = removePairButton.closest('li');
            pairDiv.remove();
            if (liForValidation) {
                validateAndUpdateLotInputs(liForValidation);
            }
        });
        pairDiv.appendChild(removePairButton);
    }
    container.appendChild(pairDiv);
    if (liParent) {
        validateAndUpdateLotInputs(liParent);
    }
}

function openCalculationModal() {
    if (!currentRecipeData) { ui.showStatusMessage(elements.calculateStatus, "Dados da receita não disponíveis.", "error"); return; }
    domElements.modalItemNameSpan.textContent = currentRecipeData.name;
    domElements.modalCraftQuantityInput.value = 1;
    domElements.modalMaterialsList.innerHTML = '';

    currentRecipeData.materials.forEach(mat => {
        const li = document.createElement('li');
        li.dataset.materialName = mat.material_name;
        li.dataset.baseQuantity = mat.quantity;
        li.dataset.totalNeeded = mat.quantity * 1;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'material-name-display material-quantity-display';
        nameSpan.textContent = `...x ${mat.material_name}`;
        li.appendChild(nameSpan);

        if (mat.material_type === 'profession') {
            nameSpan.textContent += ` (Profissão)`;

            const toggleCostButton = document.createElement('button');
            toggleCostButton.type = 'button';
            toggleCostButton.textContent = '+ Custo';
            toggleCostButton.className = 'button button-secondary button-xsmall add-prof-cost-button';
            toggleCostButton.title = 'Adicionar custo unitário para este item';
            li.appendChild(toggleCostButton);

            const costArea = document.createElement('div');
            costArea.className = 'profession-cost-area';
            costArea.style.display = 'none';

            const costLabel = document.createElement('label');
            costLabel.textContent = 'Custo Unitário:';
            const inputId = `prof-cost-${mat.material_name.replace(/\s+/g, '-')}-${Date.now()}`;
            costLabel.htmlFor = inputId;

            const costInput = document.createElement('input');
            costInput.type = 'number';
            costInput.min = '0';
            costInput.value = '0';
            costInput.className = 'profession-cost-input';
            costInput.dataset.materialName = mat.material_name;
            costInput.id = inputId;
            costInput.placeholder = '0';

            costArea.appendChild(costLabel);
            costArea.appendChild(costInput);
            li.appendChild(costArea);

            toggleCostButton.addEventListener('click', () => {
                const isHidden = costArea.style.display === 'none';
                costArea.style.display = isHidden ? 'flex' : 'none';
                toggleCostButton.textContent = isHidden ? '- Custo' : '+ Custo';
                toggleCostButton.title = isHidden ? 'Remover custo unitário' : 'Adicionar custo unitário para este item';
                if (!isHidden) costInput.value = '0';
            });

        } else {
            const npcPriceFormatted = calculator.formatCurrency(mat.default_npc_price || 0);
            const npcRefSpan = document.createElement('span');
            npcRefSpan.className = 'material-npc-ref';
            npcRefSpan.textContent = ` (NPC Ref: ${npcPriceFormatted})`;
            li.appendChild(npcRefSpan);

            const pairsContainer = document.createElement('div');
            pairsContainer.className = 'price-qty-pairs-container';
            li.appendChild(pairsContainer);

            const initialQtyNeeded = mat.quantity;
            const initialNpcPrice = mat.default_npc_price || 0;
            addPriceQtyPair(pairsContainer, mat.material_name, true, initialQtyNeeded, initialNpcPrice);

            const addPairButton = document.createElement('button');
            addPairButton.type = 'button';
            addPairButton.textContent = '+ Lote';
            addPairButton.className = 'button button-secondary add-pair-button button-small';
            addPairButton.title = 'Adicionar outro lote deste material';
            addPairButton.addEventListener('click', () => {
                addPriceQtyPair(pairsContainer, mat.material_name, false);
            });
            li.appendChild(addPairButton);
        }
        domElements.modalMaterialsList.appendChild(li);
    });

    domElements.modalSellPriceNpcBaseSpan.textContent = calculator.formatCurrency(currentRecipeData.npc_sell_price || 0);
    domElements.modalSellPriceMarketInput.value = '';
    updateDynamicModalValues();
    domElements.modalResultsDiv.style.display = 'none';
    ui.hideStatusMessage(elements.modalStatus);
    domElements.calculationModal.style.display = 'flex';
}

function closeCalculationModal() {
    if (domElements.calculationModal) { domElements.calculationModal.style.display = 'none'; }
    currentRecipeData = null;
}

function updateDynamicModalValues() {
    if (!currentRecipeData || !domElements.modalCraftQuantityInput || !domElements.modalTotalItemsLabel || !domElements.modalSellPriceNpcTotalSpan || !domElements.modalCalcPacksLabelNpc || !domElements.modalMaterialsList) {
        console.warn("[updateDynamicModalValues] Elementos/Dados ausentes.");
        return;
    }
    const desiredPacks = parseInt(domElements.modalCraftQuantityInput.value, 10) || 0;
    const baseQuantityProduced = currentRecipeData.quantity_produced || 1;
    const totalItems = desiredPacks * baseQuantityProduced;
    const totalNpcPrice = (currentRecipeData.npc_sell_price || 0) * desiredPacks;

    domElements.modalTotalItemsLabel.textContent = calculator.formatCurrency(totalItems);
    domElements.modalCalcPacksLabelNpc.textContent = desiredPacks;
    domElements.modalSellPriceNpcTotalSpan.textContent = calculator.formatCurrency(totalNpcPrice);
    if(domElements.modalCalcPacksLabelResults) {
        domElements.modalCalcPacksLabelResults.textContent = desiredPacks;
    }

    try {
        domElements.modalMaterialsList.querySelectorAll('li').forEach(li => {
            const nameSpan = li.querySelector('.material-quantity-display');
            const baseQuantityMaterial = parseInt(li.dataset.baseQuantity, 10);
            const materialName = li.dataset.materialName;
            const recipeMaterial = currentRecipeData.materials.find(m => m.material_name === materialName);

            if (nameSpan && !isNaN(baseQuantityMaterial) && materialName && recipeMaterial) {
                const newTotalQuantity = baseQuantityMaterial * desiredPacks;
                li.dataset.totalNeeded = newTotalQuantity;

                const formattedQuantity = calculator.formatCurrency(newTotalQuantity);
                let textContent = `${formattedQuantity}x ${materialName}`;
                if (recipeMaterial.material_type === 'profession') {
                    textContent += ` (Profissão)`;
                }
                nameSpan.textContent = textContent;

                if (recipeMaterial.material_type !== 'profession') {
                    const firstQtyInput = li.querySelector('.market-qty-input');
                    if (firstQtyInput && firstQtyInput.closest('.price-qty-pair') === li.querySelector('.price-qty-pair:first-child')) {
                        firstQtyInput.value = newTotalQuantity > 0 ? newTotalQuantity : '';
                    }
                    validateAndUpdateLotInputs(li);
                } else {
                    const profCostInput = li.querySelector('.profession-cost-input');
                    if(profCostInput) profCostInput.classList.remove('input-valid', 'input-invalid', 'input-warning');
                }
            } else {
                console.warn(`[updateDynamicModalValues] Falha ao atualizar dados para: ${materialName || 'material desconhecido'}.`);
            }
        });
    } catch (error) {
        console.error("[updateDynamicModalValues] Erro ao atualizar lista de materiais:", error);
    }
}

function handleModalConfirm() {
    if (!currentRecipeData) return;
    ui.showStatusMessage(elements.modalStatus, "Validando e Calculando...", "loading");
    const desiredPacks = parseInt(domElements.modalCraftQuantityInput.value, 10);
    if (isNaN(desiredPacks) || desiredPacks <= 0) { ui.showStatusMessage(elements.modalStatus, "Quantidade de Packs inválida.", "error"); return; }

    let isOverallValid = true;
    let hasWarnings = false;
    const marketPricesMaterialsAvg = {};
    const materialListItems = domElements.modalMaterialsList.querySelectorAll('li');

    for (const li of materialListItems) {
        const materialName = li.dataset.materialName;
        const recipeMaterial = currentRecipeData.materials.find(m => m.material_name === materialName);
        if (recipeMaterial && (recipeMaterial.material_type === 'drop' || recipeMaterial.material_type === 'buy')) {
            const isMaterialInvalid = li.querySelector('.market-qty-input.input-invalid') !== null;
            if (isMaterialInvalid) {
                const totalNeeded = calculator.formatCurrency(parseInt(li.dataset.totalNeeded || 0, 10));
                let currentSum = 0;
                li.querySelectorAll('.market-qty-input').forEach(input => { currentSum += parseInt(input.value, 10) || 0; });
                const formattedSum = calculator.formatCurrency(currentSum);
                const errorMsg = `Erro: Quantidade do lote para '${materialName}' (${formattedSum}) excede o necessário (${totalNeeded}). Ajuste os campos em vermelho.`;
                ui.showStatusMessage(elements.modalStatus, errorMsg, "error");
                isOverallValid = false;
                break;
            }
            const isMaterialWarning = li.querySelector('.market-qty-input.input-warning') !== null;
            if (isMaterialWarning) {
                hasWarnings = true;
            }
        }
    }

    if (!isOverallValid) {
        console.warn("[handleModalConfirm] Validação final falhou (erro nos inputs).");
        if (domElements.modalResultsDiv) domElements.modalResultsDiv.style.display = 'none';
        return;
    }

    const professionCosts = {};
    materialListItems.forEach(li => {
        const profCostInput = li.querySelector('.profession-cost-input');
        if (profCostInput && profCostInput.closest('.profession-cost-area')?.style.display !== 'none') {
            const materialName = profCostInput.dataset.materialName;
            const cost = parseFloat(profCostInput.value);
            if (materialName && !isNaN(cost) && cost >= 0) {
                professionCosts[materialName] = cost;
            }
        }
    });

    let calculationError = false;
    materialListItems.forEach(li => {
        const materialName = li.dataset.materialName;
        const recipeMaterial = currentRecipeData.materials.find(m => m.material_name === materialName);
        if (recipeMaterial && (recipeMaterial.material_type === 'drop' || recipeMaterial.material_type === 'buy')) {
            const pairsContainer = li.querySelector('.price-qty-pairs-container');
            if (!pairsContainer) {
                console.error(`Container de pares não encontrado para ${materialName}`);
                calculationError = true; return;
            }
            const pairs = pairsContainer.querySelectorAll('.price-qty-pair');
            let totalCostForMaterial = 0;
            let totalQtyForMaterial = 0;
            pairs.forEach(pair => {
                const priceInput = pair.querySelector('.market-price-input');
                const qtyInput = pair.querySelector('.market-qty-input');
                const price = parseFloat(priceInput?.value);
                const qty = parseInt(qtyInput?.value, 10);

                if (qtyInput?.value.trim() === '' && priceInput?.value.trim() === '') {
                    return;
                }
                if (isNaN(price) || price < 0 || isNaN(qty) || qty <= 0) {
                    ui.showStatusMessage(elements.modalStatus, `Dados inválidos no lote para ${materialName}: Preço=${priceInput?.value}, Qtd=${qtyInput?.value}. Verifique.`, "error");
                    calculationError = true; return;
                }
                totalCostForMaterial += price * qty;
                totalQtyForMaterial += qty;
            });
            if(calculationError) return;

            const avgPrice = (totalQtyForMaterial > 0) ? totalCostForMaterial / totalQtyForMaterial : 0;
            marketPricesMaterialsAvg[materialName] = avgPrice;
        }
    });

    if (calculationError) {
        if (domElements.modalResultsDiv) domElements.modalResultsDiv.style.display = 'none';
        return;
    }

    const marketSellPricePerPack = parseFloat(domElements.modalSellPriceMarketInput.value);
    if (domElements.modalSellPriceMarketInput.value.trim() === '' || isNaN(marketSellPricePerPack) || marketSellPricePerPack < 0) {
        ui.showStatusMessage(elements.modalStatus, "Preço de venda no mercado inválido ou não informado.", "error");
        if (domElements.modalResultsDiv) domElements.modalResultsDiv.style.display = 'none';
        return;
    }

    try {
        const totalCost = calculator.calculateCraftingCost(currentRecipeData, marketPricesMaterialsAvg, desiredPacks, professionCosts);
        const totalMarketRevenue = marketSellPricePerPack * desiredPacks;
        const sellPricesForCalc = { market: totalMarketRevenue };
        const profitResults = calculator.calculateProfit(totalCost, currentRecipeData, sellPricesForCalc, desiredPacks);

        displayModalResults(totalCost, profitResults, desiredPacks);

        if (hasWarnings && isOverallValid) {
            ui.showStatusMessage(elements.modalStatus, "Atenção: Quantidade de alguns lotes é menor que o necessário. Custo calculado com base no informado.", "info");
        } else if (isOverallValid) {
            ui.hideStatusMessage(elements.modalStatus);
        }

    } catch (error) {
        console.error("Erro durante cálculo final:", error);
        ui.showStatusMessage(elements.modalStatus, `Erro no cálculo: ${error.message || 'Erro desconhecido.'}`, "error");
        if (domElements.modalResultsDiv) domElements.modalResultsDiv.style.display = 'none';
    }
}

function displayModalResults(cost, profits, packsCalculated) {
    if (domElements.modalCalcPacksLabelResults) domElements.modalCalcPacksLabelResults.textContent = packsCalculated;
    domElements.modalResultCost.textContent = calculator.formatCurrency(cost);
    domElements.modalResultRevenueMarket.textContent = calculator.formatCurrency(profits.totalRevenueMarket);
    domElements.modalResultRevenueNpc.textContent = calculator.formatCurrency(profits.totalRevenueNPC);
    domElements.modalResultProfitMarket.textContent = calculator.formatCurrency(profits.profitMarket);
    domElements.modalResultProfitNpc.textContent = calculator.formatCurrency(profits.profitNPC);
    const compensaMarket = domElements.modalCompensaMarket; const compensaNpc = domElements.modalCompensaNpc;
    if (compensaMarket) { compensaMarket.textContent = profits.profitMarket > 0 ? '(Compensa)' : profits.profitMarket < 0 ? '(Não Compensa)' : '(Neutro)'; compensaMarket.style.color = profits.profitMarket >= 0 ? 'var(--color-success)' : 'var(--color-danger)'; }
    if (compensaNpc) { compensaNpc.textContent = profits.profitNPC > 0 ? '(Compensa)' : profits.profitNPC < 0 ? '(Não Compensa)' : '(Neutro)'; compensaNpc.style.color = profits.profitNPC >= 0 ? 'var(--color-success)' : 'var(--color-danger)'; }
    const percentageSpan = domElements.modalProfitPercentageMarket;
    if (percentageSpan) {
        let marketProfitPercentageText = '- %'; let percentageColor = 'inherit';
        if (cost > 0) { const marketProfitPercentage = (profits.profitMarket / cost) * 100; marketProfitPercentageText = `(${marketProfitPercentage.toFixed(1)}%)`; percentageColor = profits.profitMarket >= 0 ? 'var(--color-success)' : 'var(--color-danger)'; }
        else if (profits.profitMarket > 0) { marketProfitPercentageText = '(∞%)'; percentageColor = 'var(--color-success)'; }
        else { marketProfitPercentageText = '(0.0%)'; percentageColor = 'inherit'; }
        percentageSpan.textContent = marketProfitPercentageText; percentageSpan.style.color = percentageColor;
    }
    const profMatLine = domElements.modalProfitPerProfMatLine; const profMatValueSpan = domElements.modalProfitPerProfMatValue;
    const firstProfessionMat = currentRecipeData?.materials?.find(mat => mat.material_type === 'profession');
    if (profMatLine && profMatValueSpan && firstProfessionMat && packsCalculated > 0) {
        const profMatQuantityPerPack = firstProfessionMat.quantity || 0; const totalProfessionMats = profMatQuantityPerPack * packsCalculated;
        let profitPerMatText = "N/A"; let profitPerMatColor = 'inherit';
        const nameSpan = profMatLine.querySelector(elements.profMatNameSpan); if(nameSpan) nameSpan.textContent = firstProfessionMat.material_name;
        if (totalProfessionMats > 0) { const profitPerMatValue = profits.profitMarket / totalProfessionMats; profitPerMatText = profitPerMatValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); profitPerMatColor = profits.profitMarket >= 0 ? 'var(--color-success)' : 'var(--color-danger)'; }
        profMatValueSpan.textContent = profitPerMatText; profMatValueSpan.style.color = profitPerMatColor; profMatLine.style.display = 'block';
    } else if (profMatLine) { profMatLine.style.display = 'none'; }
    if (domElements.modalResultsDiv) domElements.modalResultsDiv.style.display = 'block';
}

function filterItems(searchTerm) {
    if (!allItems || !domElements.calculateItemList) return;

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    let filteredItemWrappers;

    if (!normalizedSearchTerm) {
        filteredItemWrappers = allItems.map(item => ({ item: item, isSubItemMatch: false }));
    } else {
        filteredItemWrappers = allItems.map(item => {
            const itemNameMatch = item.name.toLowerCase().includes(normalizedSearchTerm);
            const subItemMatch = item.materials && item.materials.some(material =>
                material.material_name.toLowerCase().includes(normalizedSearchTerm)
            );

            if (itemNameMatch) {
                return { item: item, isSubItemMatch: false, directMatch: true };
            } else if (subItemMatch) {
                return { item: item, isSubItemMatch: true, directMatch: false };
            }
            return null;
        }).filter(wrapper => wrapper !== null)
          .sort((a, b) => {
            if (a.directMatch && !b.directMatch) return -1;
            if (!a.directMatch && b.directMatch) return 1;
            return 0;
          });
    }
    renderCalculateItemList(filteredItemWrappers);
}
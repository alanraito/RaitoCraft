/*
  Arquivo: editView.js
  Descrição: Este módulo é responsável pela funcionalidade da "Página de Gerenciamento de Itens".
  Ele permite aos usuários visualizar, pesquisar, editar e deletar receitas de itens existentes.
  As edições são realizadas através de um modal que é preenchido com os dados do item selecionado.
  Principais Funções:
  - initEditView: Inicializa a view, busca elementos DOM e configura listeners para pesquisa,
                  botões de editar/deletar nos cards e para os controles do modal de edição.
  - loadItemsForEditing: Busca todos os itens (com seus materiais) da API e dispara a renderização
                         ou filtragem da lista de itens.
  - renderEditItemList: Cria e exibe os cards dos itens na página. Cada card possui botões para
                        editar ou deletar a respectiva receita. Destaca cards se a pesquisa
                        corresponder a um de seus materiais.
  - filterItemsForEditing: Filtra a lista de itens com base no termo de pesquisa, priorizando
                           correspondências diretas no nome do item.
  - openEditModal: Busca os dados detalhados do item selecionado (para garantir a versão mais recente)
                   e preenche o formulário no modal de edição com esses dados.
  - closeEditModal: Fecha o modal de edição e reseta seu formulário.
  - handleUpdateItem: Coleta os dados do formulário do modal de edição, valida-os e envia uma
                      requisição de atualização para a API. Recarrega a lista de itens após o sucesso.
  - handleDeleteItem: Solicita confirmação do usuário e, se confirmado, envia uma requisição
                      de deleção para a API. Recarrega a lista de itens após o sucesso.
  Módulos Importados:
  - api (apiService.js): Para interagir com o backend (buscar, atualizar, deletar itens).
  - ui (ui.js): Para funções utilitárias da UI, como exibir mensagens de status e
                manipular os campos de entrada de materiais no modal.
*/
import * as api from '../apiService.js';
import * as ui from '../ui.js';

const elements = {
    editItemList: 'edit-item-list',
    editLoadingMsg: 'edit-loading-message',
    editStatus: 'edit-status',
    editFormContainer: 'edit-form-container',
    editItemSearch: 'edit-item-search',

    editModal: 'edit-item-modal',
    editModalCloseButton: 'edit-modal-close-button',
    editModalForm: 'edit-modal-form',
    editModalItemId: 'edit-modal-item-id',
    editModalItemTitleName: 'edit-modal-item-title-name',
    editModalNameInput: 'edit-modal-name',
    editModalQuantityInput: 'edit-modal-quantity',
    editModalNpcSellPriceInput: 'edit-modal-npc-sell-price',
    editModalMaterialsContainer: 'edit-modal-materials-container',
    editModalAddMaterialButton: 'edit-modal-add-material-button',
    editModalCancelButton: 'edit-modal-cancel-button',
    editModalStatus: 'edit-modal-status',
};

let domElements = {};
let allItemsWithMaterials = [];
let currentEditingItemId = null;

export function initEditView() {
    console.log("[editView] Inicializando...");
    Object.keys(elements).forEach(key => {
        domElements[key] = document.getElementById(elements[key]);
    });

    const missingElement = Object.keys(elements).find(key => !domElements[key]);
    if (missingElement && elements[missingElement] !== null) {
        console.error(`[editView] ERRO FATAL: Elemento não encontrado: #${elements[missingElement]}`);
        if(domElements.editStatus) ui.showStatusMessage(elements.editStatus, `Erro: Falha ao carregar UI de edição (${elements[missingElement]}).`, "error");
        return;
    }
    console.log("[editView] Todos elementos essenciais encontrados.");

    if (domElements.editItemSearch) {
        domElements.editItemSearch.addEventListener('input', () => filterItemsForEditing(domElements.editItemSearch.value));
    }

    if (domElements.editModalCloseButton) {
        domElements.editModalCloseButton.addEventListener('click', closeEditModal);
    }
    if (domElements.editModalForm) {
        domElements.editModalForm.addEventListener('submit', handleUpdateItem);
    }
    if (domElements.editModalAddMaterialButton) {
        domElements.editModalAddMaterialButton.addEventListener('click', () => {
            if (domElements.editModalMaterialsContainer) {
                ui.addMaterialInput(domElements.editModalMaterialsContainer);
            }
        });
    }
    if (domElements.editModalCancelButton) {
        domElements.editModalCancelButton.addEventListener('click', closeEditModal);
    }

    loadItemsForEditing();
}

async function loadItemsForEditing() {
    if (domElements.editLoadingMsg) domElements.editLoadingMsg.style.display = 'block';
    if (domElements.editItemList) domElements.editItemList.innerHTML = '';
    ui.hideStatusMessage(elements.editStatus);
    closeEditModal();

    try {
        allItemsWithMaterials = await api.fetchItems();
        filterItemsForEditing(domElements.editItemSearch ? domElements.editItemSearch.value : '');

        if (domElements.editLoadingMsg) domElements.editLoadingMsg.style.display = 'none';
        if (!allItemsWithMaterials || allItemsWithMaterials.length === 0) {
            ui.showStatusMessage(elements.editStatus, "Nenhum item registrado para gerenciar.", "info");
        }
    } catch (error) {
        console.error("Erro ao carregar itens para edição:", error);
        if (domElements.editLoadingMsg) domElements.editLoadingMsg.textContent = 'Erro ao carregar.';
        ui.showStatusMessage(elements.editStatus, `Erro ao carregar itens: ${error.message || 'Verifique console.'}`, "error");
    }
}

function renderEditItemList(itemsToRender) {
    const container = domElements.editItemList;
    if (!container) return;
    container.innerHTML = '';

    if (!itemsToRender || itemsToRender.length === 0) {
         if (domElements.editItemSearch && domElements.editItemSearch.value) {
            container.innerHTML = '<p class="info-text">Nenhum item encontrado com o termo pesquisado.</p>';
        }
        return;
    }

    itemsToRender.forEach(itemWrapper => {
        const item = itemWrapper.item;
        const isSubItemMatch = itemWrapper.isSubItemMatch;

        const card = document.createElement('div');
        card.className = 'item-card item-card-edit';
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
        const producesText = `Produz: ${item.quantity_produced || 1}`;
        const npcPriceText = `Preço NPC (Pack): ${ui.formatCurrency(item.npc_sell_price || 0)}`;
        detailsP.textContent = `${producesText} | ${npcPriceText}`;
        infoDiv.appendChild(detailsP);

        card.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-card-actions';

        const editButton = document.createElement('button');
        editButton.textContent = 'Editar';
        editButton.className = 'button button-secondary';
        editButton.dataset.id = item.id;
        editButton.addEventListener('click', () => openEditModal(item.id));
        actionsDiv.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Deletar';
        deleteButton.className = 'button button-danger';
        deleteButton.dataset.id = item.id;
        deleteButton.addEventListener('click', () => handleDeleteItem(item.id, item.name));
        actionsDiv.appendChild(deleteButton);

        card.appendChild(actionsDiv);
        container.appendChild(card);
    });
}

function filterItemsForEditing(searchTerm) {
    if (!allItemsWithMaterials || !domElements.editItemList) return;

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    let filteredItemWrappers;

    if (!normalizedSearchTerm) {
        filteredItemWrappers = allItemsWithMaterials.map(item => ({ item: item, isSubItemMatch: false }));
    } else {
        filteredItemWrappers = allItemsWithMaterials.map(item => {
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
    renderEditItemList(filteredItemWrappers);
}

async function openEditModal(itemId) {
    ui.showStatusMessage(elements.editModalStatus, "Carregando dados do item...", "loading");
    domElements.editModal.style.display = 'flex';

    try {
        const itemData = await api.fetchRecipe(itemId);

        if (!itemData) {
            ui.showStatusMessage(elements.editModalStatus, "Erro: Item não encontrado.", "error");
            setTimeout(closeEditModal, 2000);
            return;
        }

        currentEditingItemId = itemData.id;
        if (domElements.editModalItemTitleName) domElements.editModalItemTitleName.textContent = itemData.name;
        if (domElements.editModalItemId) domElements.editModalItemId.value = itemData.id;
        if (domElements.editModalNameInput) domElements.editModalNameInput.value = itemData.name;
        if (domElements.editModalQuantityInput) domElements.editModalQuantityInput.value = itemData.quantity_produced;
        if (domElements.editModalNpcSellPriceInput) domElements.editModalNpcSellPriceInput.value = itemData.npc_sell_price || 0;

        if (domElements.editModalMaterialsContainer) {
            domElements.editModalMaterialsContainer.innerHTML = '';
            if (itemData.materials && itemData.materials.length > 0) {
                itemData.materials.forEach(material => {
                    ui.addMaterialInput(domElements.editModalMaterialsContainer, material);
                });
            } else {
                ui.addMaterialInput(domElements.editModalMaterialsContainer);
            }
        }
        ui.hideStatusMessage(elements.editModalStatus);

    } catch (error) {
        console.error("Erro ao buscar item para edição:", error);
        ui.showStatusMessage(elements.editModalStatus, `Erro ao carregar: ${error.message}`, "error");
    }
}

function closeEditModal() {
    if (domElements.editModal) domElements.editModal.style.display = 'none';
    if (domElements.editModalForm) domElements.editModalForm.reset();
    if (domElements.editModalMaterialsContainer) domElements.editModalMaterialsContainer.innerHTML = '';
    ui.hideStatusMessage(elements.editModalStatus);
    currentEditingItemId = null;
}

async function handleUpdateItem(event) {
    event.preventDefault();
    if (!currentEditingItemId) return;

    const name = domElements.editModalNameInput.value.trim();
    const quantityProduced = parseInt(domElements.editModalQuantityInput.value, 10);
    const npcSellPrice = parseInt(domElements.editModalNpcSellPriceInput.value, 10) || 0;
    const materials = ui.getMaterialsData(domElements.editModalMaterialsContainer);

    if (!name || isNaN(quantityProduced) || quantityProduced <= 0) {
        ui.showStatusMessage(elements.editModalStatus, "Nome e quantidade produzida são obrigatórios e válidos.", "error");
        return;
    }
    if (!materials) {
        ui.showStatusMessage(elements.editModalStatus, "Verifique os dados dos materiais. Campos obrigatórios devem ser preenchidos corretamente.", "error");
        return;
    }
     if (materials.length === 0) {
        ui.showStatusMessage(elements.editModalStatus, "Ao menos um material é necessário para a receita.", "error");
        return;
    }

    const updatedData = {
        name,
        quantity_produced: quantityProduced,
        npc_sell_price: npcSellPrice,
        materials
    };

    ui.showStatusMessage(elements.editModalStatus, "Salvando alterações...", "loading");

    try {
        await api.updateItem(currentEditingItemId, updatedData);
        ui.showStatusMessage(elements.editModalStatus, "Item atualizado com sucesso!", "success");
        loadItemsForEditing();
        setTimeout(closeEditModal, 1500);
    } catch (error) {
        console.error("Erro ao atualizar item:", error);
        ui.showStatusMessage(elements.editModalStatus, `Erro ao salvar: ${error.message}`, "error");
    }
}

async function handleDeleteItem(itemId, itemName) {
    if (!confirm(`Tem certeza que deseja deletar o item "${itemName}" (ID: ${itemId})? Esta ação não pode ser desfeita.`)) {
        return;
    }

    ui.showStatusMessage(elements.editStatus, `Deletando ${itemName}...`, "loading");
    try {
        await api.deleteItem(itemId);
        ui.showStatusMessage(elements.editStatus, `"${itemName}" deletado com sucesso!`, "success");
        loadItemsForEditing();
    } catch (error) {
        console.error(`Erro ao deletar item ${itemId}:`, error);
        ui.showStatusMessage(elements.editStatus, `Erro ao deletar "${itemName}": ${error.message}`, "error");
    }
}
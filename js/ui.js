/*
  Arquivo: ui.js
  Descrição: Este módulo fornece funções utilitárias para interagir com a interface do usuário (UI).
  Ele centraliza a lógica para manipulação de elementos DOM comuns, como exibição de mensagens de status,
  criação dinâmica de campos de formulário para materiais e coleta de dados desses campos.
  Principais Funções:
  - showStatusMessage: Exibe uma mensagem (de sucesso, erro, informação, carregamento) em um elemento
                       específico da UI. As mensagens podem ter um tempo de auto-ocultação.
  - hideStatusMessage: Oculta uma mensagem de status previamente exibida.
  - addMaterialInput: Cria e adiciona dinamicamente um conjunto de campos de formulário (nome, quantidade, tipo, preço NPC)
                      para um material em um container especificado. Permite pré-preencher os campos
                      com dados existentes (útil para formulários de edição).
                      Modificação: Agora utiliza placeholders e evita valores padrão ('0', '1')
                      quando nenhum dado inicial é fornecido. O tipo 'drop' foi removido das opções.
  - getMaterialsData: Coleta e valida os dados de todos os campos de materiais dentro de um container.
                      Retorna um array de objetos de material ou null se houver erros de validação.
  - formatCurrency: Formata um valor numérico como uma string de moeda. (Duplicada de calculator.js,
                    considerar centralizar ou remover uma das ocorrências se forem idênticas).
*/

export function showStatusMessage(elementId, message, type = 'info') {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) { console.warn(`Elemento de status não encontrado: #${elementId}`); return; }
    statusElement.textContent = message; statusElement.className = 'status-message'; let autoHide = true;
    switch (type) {
        case 'success': statusElement.classList.add('status-success'); break;
        case 'error': statusElement.classList.add('status-error'); break;
        case 'loading': statusElement.classList.add('status-loading'); autoHide = false; break;
        case 'info': default: statusElement.classList.add('status-info'); break;
    }
    statusElement.style.display = 'block';
     if (autoHide) {
         setTimeout(() => { if (statusElement.style.display !== 'none' && statusElement.textContent === message) { hideStatusMessage(elementId); }}, 5000);
     }
}

export function hideStatusMessage(elementId) {
    const statusElement = document.getElementById(elementId);
    if (statusElement) { statusElement.style.display = 'none'; statusElement.textContent = ''; statusElement.className = 'status-message'; }
}

export function addMaterialInput(container, materialData = {}) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'material-entry';

    const idSuffix = Date.now() + Math.random().toString(16).slice(2);

    const nameDiv = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nome Material:';
    nameLabel.htmlFor = `mat-name-${idSuffix}`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'material_name';
    nameInput.id = nameLabel.htmlFor;
    nameInput.value = materialData.material_name || '';
    nameInput.placeholder = "Nome do Material";
    nameInput.required = true;
    nameDiv.append(nameLabel, nameInput);

    const quantityDiv = document.createElement('div');
    const quantityLabel = document.createElement('label');
    quantityLabel.textContent = 'Qtd:';
    quantityLabel.htmlFor = `mat-qty-${idSuffix}`;
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.name = 'quantity';
    quantityInput.id = quantityLabel.htmlFor;
    quantityInput.value = materialData.quantity || '';
    quantityInput.placeholder = "1";
    quantityInput.min = '1';
    quantityInput.required = true;
    quantityDiv.append(quantityLabel, quantityInput);

    const typeDiv = document.createElement('div');
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Tipo:';
    typeLabel.htmlFor = `mat-type-${idSuffix}`;
    const typeSelect = document.createElement('select');
    typeSelect.name = 'material_type';
    typeSelect.id = typeLabel.htmlFor;
    typeSelect.required = true;

    ['buy', 'profession'].forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        if (materialData.material_type === type) option.selected = true;
        typeSelect.appendChild(option);
    });
    typeDiv.append(typeLabel, typeSelect);

    const npcPriceDiv = document.createElement('div');
    npcPriceDiv.className = 'npc-price-field-container';
    const npcLabel = document.createElement('label');
    npcLabel.textContent = 'Preço NPC (Ref):';
    npcLabel.htmlFor = `mat-npc-${idSuffix}`;
    const npcInput = document.createElement('input');
    npcInput.type = 'number';
    npcInput.name = 'default_npc_price';
    npcInput.id = npcLabel.htmlFor;
    npcInput.value = materialData.default_npc_price || '';
    npcInput.placeholder = "0";
    npcInput.min = '0';
    npcPriceDiv.append(npcLabel, npcInput);

     const toggleNpcPriceVisibility = () => {
         npcPriceDiv.style.display = (typeSelect.value === 'drop' || typeSelect.value === 'buy') ? 'block' : 'none';
     };
     typeSelect.addEventListener('change', toggleNpcPriceVisibility);

    const removeButtonDiv = document.createElement('div');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remover';
    removeButton.className = 'button button-danger remove-material-button';
    removeButton.onclick = () => entryDiv.remove();
    removeButtonDiv.appendChild(removeButton);

    entryDiv.appendChild(nameDiv);
    entryDiv.appendChild(quantityDiv);
    entryDiv.appendChild(typeDiv);
    entryDiv.appendChild(npcPriceDiv);
    entryDiv.appendChild(removeButtonDiv);

    container.appendChild(entryDiv);
    toggleNpcPriceVisibility();
}

export function getMaterialsData(container) {
    const materials = [];
    const entries = container.querySelectorAll('.material-entry');
    let isValid = true;
    entries.forEach((entry, index) => {
        const nameInput = entry.querySelector('input[name="material_name"]');
        const quantityInput = entry.querySelector('input[name="quantity"]');
        const typeSelect = entry.querySelector('select[name="material_type"]');
        const npcPriceInput = entry.querySelector('input[name="default_npc_price"]');
        const name = nameInput ? nameInput.value.trim() : '';
        const quantity = quantityInput ? parseInt(quantityInput.value, 10) : NaN;
        const type = typeSelect ? typeSelect.value : '';
        const npcPrice = npcPriceInput ? parseInt(npcPriceInput.value, 10) : NaN;

        if (!name) { console.error(`Material #${index + 1}: Nome vazio.`); isValid = false; }
        if (isNaN(quantity) || quantity <= 0) { console.error(`Material "${name || index + 1}": Quantidade inválida (${quantityInput?.value}). Deve ser número > 0.`); isValid = false; }
        if (!type || !['profession', 'drop', 'buy'].includes(type)) { console.error(`Material "${name || index + 1}": Tipo inválido (${type}).`); isValid = false; }
        const npcPriceValue = (!isNaN(npcPrice) && npcPrice >= 0) ? npcPrice : 0;

        if (isValid) {
             materials.push({
                 material_name: name,
                 quantity: quantity,
                 material_type: type,
                 default_npc_price: (type !== 'profession') ? npcPriceValue : 0
             });
        }
    });
    return isValid ? materials : null;
}

export function formatCurrency(value) {
    if (typeof value !== 'number') return '0';
    return Math.floor(value).toLocaleString('pt-BR');
}
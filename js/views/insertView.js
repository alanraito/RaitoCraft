/*
  Arquivo: insertView.js
  Descrição: Este módulo gerencia a funcionalidade da "Página de Registrar Novo Item".
  Ele fornece um formulário para que os usuários possam inserir os detalhes de uma nova receita
  de item craftável, incluindo nome do item, quantidade produzida, preço de venda no NPC e
  uma lista de materiais necessários.
  Principais Funções:
  - initInsertView: Inicializa a view, busca os elementos do formulário e configura os listeners
                    de evento para o botão de adicionar material e para a submissão do formulário.
                    Também garante que o formulário seja resetado e um campo de material inicial
                    seja adicionado ao carregar a view.
  - handleInsertSubmit: Lida com o evento de submissão do formulário. Coleta os dados do formulário,
                        valida as informações (nome, quantidade produzida, materiais) e, se válidos,
                        envia os dados para a API para criar a nova receita. Exibe mensagens de status
                        (sucesso ou erro) e reseta o formulário após o sucesso.
  - resetInsertForm: Limpa todos os campos do formulário de inserção e a lista de materiais,
                     adicionando um novo campo de material em branco para facilitar a próxima inserção.
  Módulos Importados:
  - api (apiService.js): Para enviar a nova receita para o backend.
  - ui (ui.js): Para adicionar dinamicamente campos de material ao formulário e exibir mensagens de status.
  Variáveis Globais do Módulo:
  - insertForm: Referência ao elemento DOM do formulário de inserção.
  - materialsContainer: Referência ao container DOM onde os campos de material são adicionados.
  - statusElementId: ID do elemento DOM usado para exibir mensagens de status nesta view.
*/
import * as api from '../apiService.js';
import * as ui from '../ui.js';

let insertForm = null;
let materialsContainer = null;
let statusElementId = 'insert-status';

export function initInsertView() {
    console.log("Inicializando Insert View...");
    insertForm = document.getElementById('insert-form');
    materialsContainer = document.getElementById('insert-materials-container');
    const addMaterialButton = document.getElementById('add-material-button');

    if (!insertForm || !materialsContainer || !addMaterialButton) {
        console.error("Elementos essenciais da Insert View não encontrados.");
        return;
    }

    resetInsertForm();

    addMaterialButton.addEventListener('click', () => {
        ui.addMaterialInput(materialsContainer);
    });

    insertForm.addEventListener('submit', handleInsertSubmit);

     if (!materialsContainer.hasChildNodes()) {
        ui.addMaterialInput(materialsContainer);
     }
}

async function handleInsertSubmit(event) {
    event.preventDefault();
    ui.showStatusMessage(statusElementId, 'Salvando receita...', 'loading');

    const formData = new FormData(insertForm);
    const materials = ui.getMaterialsData(materialsContainer);

    if (materials === null) {
         ui.showStatusMessage(statusElementId, 'Erro: Verifique os dados dos materiais inseridos.', 'error');
         return;
    }

    const recipeData = {
        name: formData.get('name')?.trim(),
        quantity_produced: parseInt(formData.get('quantity_produced'), 10),
        npc_sell_price: parseInt(formData.get('npc_sell_price'), 10) || 0,
        materials: materials
    };

    if (!recipeData.name || !recipeData.quantity_produced || recipeData.quantity_produced <= 0) {
        ui.showStatusMessage(statusElementId, 'Erro: Nome e Quantidade Produzida (> 0) são obrigatórios.', 'error');
        return;
    }
    if (recipeData.materials.length === 0) {
         ui.showStatusMessage(statusElementId, 'Erro: Adicione pelo menos um material.', 'error');
         return;
    }

    try {
        const result = await api.createItem(recipeData);
        ui.showStatusMessage(statusElementId, `Sucesso! Receita "${recipeData.name}" salva com ID: ${result.id}.`, 'success');
        resetInsertForm();
    } catch (error) {
        console.error("Erro ao salvar receita:", error);
        const errorMessage = error.message || "Ocorreu um erro desconhecido.";
        ui.showStatusMessage(statusElementId, `Erro ao salvar: ${errorMessage}`, 'error');
    }
}

function resetInsertForm() {
    if (insertForm) {
        insertForm.reset();
    }
    if (materialsContainer) {
        materialsContainer.innerHTML = '';
        ui.addMaterialInput(materialsContainer);
    }
     ui.hideStatusMessage(statusElementId);
}
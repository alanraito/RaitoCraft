/*
  Arquivo: main.js
  Descrição: Este é o arquivo principal de JavaScript para o frontend da aplicação.
  Ele gerencia a inicialização geral da aplicação, a navegação entre as diferentes "páginas" (views),
  o controle do tema (claro/escuro) e a interatividade do menu de navegação (incluindo o menu hambúrguer
  para dispositivos móveis). Também implementa a funcionalidade de swipe para navegação em telas sensíveis ao toque,
  o comportamento de ocultar/mostrar o header ao rolar a página, e a interface/lógica do chatbot,
  incluindo feedback visual durante o processamento de mensagens, sugestões dinâmicas de perguntas contextuais,
  renderização de Markdown nas respostas do bot, e a funcionalidade de arrastar para fechar o chat em mobile.
  A animação de abertura do chatbot é controlada por CSS para uma entrada suave.
  Principais Funções:
  - initializeApp: Ponto de entrada que configura os listeners de eventos globais, carrega a view inicial (Home),
                   inicializa o chatbot, configura Marked.js e busca dados para sugestões.
  - navigateTo: Controla a transição animada entre as diferentes views (Home, Calcular, Inserir, Editar, About).
  - applyTheme, toggleTheme, loadInitialTheme: Gerenciam a aplicação do tema claro/escuro.
  - handleScroll: Oculta/mostra o header ao rolar a página.
  - handleTouchStart, handleTouchEnd, handleSwipeGesture: Implementam navegação por swipe entre páginas.
  - toggleMobileMenu: Controla o menu de navegação mobile.
  - initializeChatbotUI: Configura listeners para a UI do chat, incluindo interações com o chatbotService,
                         inicializa sugestões e a funcionalidade de arrastar para fechar o chat.
  - handleChatHeaderTouchStart, handleChatHeaderTouchMove, handleChatHeaderTouchEnd: Gerenciam o gesto de arrastar para fechar o chat.
  - fetchNamesForSuggestions: Busca nomes de itens e materiais da API para popular as sugestões.
  - updateChatbotSuggestions: Filtra e exibe sugestões de perguntas (sem duplicatas) com base no input do usuário.
  - handleSuggestionClick: Preenche o input do chat e envia a mensagem ao clicar numa sugestão.
  - toggleChatbotWindow: Alterna a visibilidade da janela do chatbot e do FAB de alternância, usando transições CSS para animação.
  - displayChatMessage: Adiciona uma mensagem (usuário ou bot) na área de mensagens do chat, renderizando Markdown para o bot.
  - handleSendMessage: Pega a mensagem do usuário, envia para o chatbotService e exibe as respostas,
                       mostrando um indicador de "digitando" durante o processamento.
  - initHomeView, initAboutView: Funções para inicialização das novas views.
  Módulos Importados:
  - initInsertView, initCalculateView, initEditView: Funções de inicialização para cada view específica.
  - ui (de ui.js): Funções utilitárias para a UI.
  - chatbotService (de services/chatbotService.js): Lógica de comunicação com o Gemini.
  - api (de apiService.js): Para buscar dados da API RaitoCraft.
  Constantes Globais:
  - Elementos DOM para páginas, navegação, header, container e chatbot.
*/
import { initInsertView } from './views/insertView.js';
import { initCalculateView } from './views/calculateView.js';
import { initEditView } from './views/editView.js';
import * as ui from './ui.js';
import * as chatbotService from './services/chatbotService.js';
import * as api from './apiService.js';

const pages = {
    'page-home': document.getElementById('page-home'),
    'page-calculate': document.getElementById('page-calculate'),
    'page-insert': document.getElementById('page-insert'),
    'page-edit': document.getElementById('page-edit'),
    'page-about': document.getElementById('page-about')
};
const navButtons = document.querySelectorAll('#main-nav button[data-page]');
const mainNavButtonsArray = Array.from(navButtons);
const globalStatusElementId = 'global-status-message';
const hamburgerButton = document.getElementById('hamburger-button');
const mainNav = document.getElementById('main-nav');
const mainHeader = document.querySelector('.main-header');
const mainContainer = document.querySelector('main.container');

const darkModeToggleButton = document.getElementById('dark-mode-toggle');

const chatbotToggleButton = document.getElementById('chatbot-toggle-button');
const chatbotWindow = document.getElementById('chatbot-window');
const chatbotHeader = document.querySelector('#chatbot-window .chatbot-header'); 
const chatbotCloseButton = document.getElementById('chatbot-close-button');
const chatbotMessagesArea = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendButton = document.getElementById('chatbot-send-button');
const chatbotSuggestionsArea = document.getElementById('chatbot-suggestions-area');

let currentView = null;
let currentPageId = null;
let isAnimating = false;
let isChatbotOpen = false;
let isChatbotProcessing = false;

let lastScrollTop = 0;
const scrollDelta = 5;

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;

let chatDragStartY = 0;
let chatDragCurrentY = 0;
let isChatDragging = false;
let initialChatTransformY = 0;


let allItemNames = new Set();
let allMaterialNames = new Set();
let debounceTimer;

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('themePreference', theme);
    if (darkModeToggleButton) {
        darkModeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
        darkModeToggleButton.title = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('themePreference') ||
                         (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function loadInitialTheme() {
    const savedTheme = localStorage.getItem('themePreference');
    const defaultTheme = (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme || defaultTheme);
}

function handleScroll() {
    if (!mainHeader) return;
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if (Math.abs(lastScrollTop - st) <= scrollDelta) return;
    if (st > lastScrollTop && st > mainHeader.offsetHeight) {
        mainHeader.classList.add('header-hidden');
    } else {
        mainHeader.classList.remove('header-hidden');
    }
    lastScrollTop = st <= 0 ? 0 : st;
}

function handleTouchStart(event) {
    if (isAnimating) return;
    if (isChatbotOpen && chatbotWindow && chatbotWindow.contains(event.target) && !chatbotHeader.contains(event.target)) return;
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
}

function handleTouchEnd(event) {
    if (isAnimating) return;
    if (isChatbotOpen && chatbotWindow && chatbotWindow.contains(event.target) && !chatbotHeader.contains(event.target)) return;
    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipeGesture();
}

function handleSwipeGesture() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
        const currentButton = document.querySelector(`#main-nav button[data-page='${currentPageId || currentView}'].active`);
        if (!currentButton) return;
        const currentIndex = mainNavButtonsArray.indexOf(currentButton);
        let nextIndex;
        let direction;
        if (deltaX < 0) { 
            nextIndex = (currentIndex + 1) % mainNavButtonsArray.length;
            direction = 'left';
        } else { 
            nextIndex = (currentIndex - 1 + mainNavButtonsArray.length) % mainNavButtonsArray.length;
            direction = 'right';
        }
        const nextPageIdToNavigate = mainNavButtonsArray[nextIndex].getAttribute('data-page');
        if (nextPageIdToNavigate && nextPageIdToNavigate !== (currentPageId || currentView)) {
            navigateTo(nextPageIdToNavigate, direction);
        }
    }
}

function handleChatHeaderTouchStart(event) {
    if (!isChatbotOpen || event.touches.length !== 1) return;
    if (chatbotCloseButton && chatbotCloseButton.contains(event.target)) {
        isChatDragging = false; 
        return;
    }
    isChatDragging = true;
    chatDragStartY = event.touches[0].clientY;
    
    const style = window.getComputedStyle(chatbotWindow);
    const matrix = new DOMMatrixReadOnly(style.transform);
    initialChatTransformY = matrix.m42; 

    chatbotWindow.style.transition = 'none'; 
}

function handleChatHeaderTouchMove(event) {
    if (!isChatDragging || event.touches.length !== 1) return;
    event.preventDefault(); 

    chatDragCurrentY = event.touches[0].clientY;
    let deltaY = chatDragCurrentY - chatDragStartY;

    if (deltaY < 0) { 
        deltaY = 0;
    }
    chatbotWindow.style.transform = `translateY(${initialChatTransformY + deltaY}px)`;
}

function handleChatHeaderTouchEnd() {
    if (!isChatDragging) return;
    isChatDragging = false;
    chatbotWindow.style.transition = ''; 

    const deltaY = chatDragCurrentY - chatDragStartY;
    const closeThreshold = chatbotWindow.offsetHeight * 0.35; 

    if (deltaY > closeThreshold) {
        toggleChatbotWindow(); 
    } else {
        chatbotWindow.style.transform = 'translateY(0)';
    }
    chatDragStartY = 0;
    chatDragCurrentY = 0;
    initialChatTransformY = 0;
}


function displayChatMessage(message, type = 'bot', id = null) {
    if (!chatbotMessagesArea) return;
    const messageDiv = document.createElement('div');
    if (id) {
        messageDiv.id = id;
    }
    messageDiv.classList.add('chatbot-message', type);

    if (type === 'bot' && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        messageDiv.innerHTML = marked.parse(message);
    } else if (type === 'bot-typing') {
        messageDiv.textContent = message;
    } else if (type === 'bot') { 
        console.warn("Marked.js não está disponível ou 'parse' não é uma função. Exibindo como texto plano com <br>.");
        messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    } else { 
        messageDiv.textContent = message; 
    }

    chatbotMessagesArea.appendChild(messageDiv);
    chatbotMessagesArea.scrollTop = chatbotMessagesArea.scrollHeight;
}

async function fetchNamesForSuggestions() {
    try {
        const items = await api.fetchItems();
        allItemNames.clear();
        allMaterialNames.clear();
        items.forEach(item => {
            if (item.name) allItemNames.add(item.name);
            if (item.materials) {
                item.materials.forEach(material => {
                    if (material.material_name) allMaterialNames.add(material.material_name);
                });
            }
        });
        console.log("Nomes para sugestões carregados. Itens:", allItemNames.size, "Materiais:", allMaterialNames.size);
    } catch (error) {
        console.error("Erro ao buscar nomes para sugestões:", error);
    }
}

function updateChatbotSuggestions(inputText) {
    if (!chatbotSuggestionsArea) return;
    chatbotSuggestionsArea.innerHTML = '';
    const query = inputText.toLowerCase().trim();

    if (query.length < 3) { 
        return;
    }

    const generatedSuggestionTexts = new Set();
    const suggestionsElements = [];
    const maxSuggestions = 3;

    const addSuggestionIfUnique = (text) => {
        if (suggestionsElements.length < maxSuggestions && !generatedSuggestionTexts.has(text)) {
            const button = document.createElement('button');
            button.classList.add('suggestion-button');
            button.textContent = text;
            button.addEventListener('click', () => handleSuggestionClick(text));
            suggestionsElements.push(button);
            generatedSuggestionTexts.add(text);
        }
    };

    allItemNames.forEach(name => {
        if (name.toLowerCase().includes(query)) {
            addSuggestionIfUnique(`Quais os materiais para ${name}?`);
            addSuggestionIfUnique(`Qual o preço NPC de ${name}?`);
        }
    });

    allMaterialNames.forEach(name => {
        if (name.toLowerCase().includes(query)) {
            addSuggestionIfUnique(`O que posso fazer com ${name}?`);
            if (!allItemNames.has(name) || !generatedSuggestionTexts.has(`Qual a demanda por ${name}?`)) {
                 addSuggestionIfUnique(`Qual a demanda por ${name}?`);
            }
        }
    });
    
    suggestionsElements.forEach(button => chatbotSuggestionsArea.appendChild(button));
}

function handleSuggestionClick(questionText) {
    if (chatbotInput) {
        chatbotInput.value = questionText;
    }
    if (chatbotSuggestionsArea) {
        chatbotSuggestionsArea.innerHTML = ''; 
    }
    handleSendMessage(); 
    chatbotInput.focus();
}


async function handleSendMessage() {
    if (!chatbotInput || !chatbotSendButton || isChatbotProcessing) return;
    const messageText = chatbotInput.value.trim();
    if (!messageText) return;

    if (chatbotSuggestionsArea) chatbotSuggestionsArea.innerHTML = ''; 
    displayChatMessage(messageText, 'user');
    chatbotInput.value = '';
    chatbotInput.disabled = true;
    chatbotSendButton.disabled = true;
    isChatbotProcessing = true;
    
    const typingIndicatorId = 'bot-typing-indicator';
    displayChatMessage("RaitoCraft Assistant está digitando", 'bot-typing', typingIndicatorId);

    try {
        const response = await chatbotService.sendMessageToGemini(messageText);
        
        const typingIndicator = document.getElementById(typingIndicatorId);
        if (typingIndicator) {
            typingIndicator.remove();
        }

        if (response.text) {
            displayChatMessage(response.text, 'bot');
        } else if (response.error) {
            displayChatMessage(`Desculpe, ocorreu um erro: ${response.error}`, 'bot');
            console.error("Erro do chatbotService:", response.error);
        } else {
            displayChatMessage("Não obtive uma resposta clara, tente novamente.", 'bot');
        }
    } catch (error) {
        const typingIndicator = document.getElementById(typingIndicatorId);
        if (typingIndicator) {
            typingIndicator.remove();
        }
        displayChatMessage(`Erro crítico ao processar sua mensagem: ${error.message}`, 'bot');
        console.error("Erro em handleSendMessage:", error);
    } finally {
        chatbotInput.disabled = false;
        chatbotSendButton.disabled = false;
        isChatbotProcessing = false;
        if(isChatbotOpen) chatbotInput.focus();
    }
}


function toggleChatbotWindow() {
    if (!chatbotWindow || !chatbotToggleButton) return;
    isChatbotOpen = !isChatbotOpen;

    // Limpa qualquer transform inline que possa ter sido deixado pelo arrasto
    // para que a transição CSS para .active ou o estado base funcione corretamente.
    chatbotWindow.style.transform = ''; 

    if (isChatbotOpen) {
        chatbotWindow.style.display = 'flex'; 
        // Forçar reflow para garantir que display:flex seja aplicado antes de adicionar a classe .active
        void chatbotWindow.offsetWidth; 
        chatbotWindow.classList.add('active');
        
        chatbotToggleButton.classList.add('hidden-by-chat-window'); 
        chatbotInput.focus();
        if (allItemNames.size === 0 && allMaterialNames.size === 0) { 
            fetchNamesForSuggestions();
        }
    } else {
        chatbotWindow.classList.remove('active'); 
        chatbotToggleButton.classList.remove('hidden-by-chat-window'); 
        if (chatbotSuggestionsArea) chatbotSuggestionsArea.innerHTML = ''; 
        
        // Espera a animação de saída (0.3s) antes de definir display: none
        setTimeout(() => {
            if (!isChatbotOpen) { // Verifica novamente, caso o usuário reabra rapidamente
                chatbotWindow.style.display = 'none';
            }
        }, 300); 
    }
}

async function initializeChatbotUI() {
    if (chatbotToggleButton) {
        chatbotToggleButton.addEventListener('click', toggleChatbotWindow);
    }
    if (chatbotCloseButton) { 
        chatbotCloseButton.addEventListener('click', toggleChatbotWindow);
    }

    if (chatbotHeader) { 
        chatbotHeader.addEventListener('touchstart', handleChatHeaderTouchStart, { passive: false });
        chatbotHeader.addEventListener('touchmove', handleChatHeaderTouchMove, { passive: false });
        chatbotHeader.addEventListener('touchend', handleChatHeaderTouchEnd);
        chatbotHeader.addEventListener('touchcancel', handleChatHeaderTouchEnd);
    }


    if (chatbotSendButton && chatbotInput) {
        chatbotSendButton.addEventListener('click', handleSendMessage);
        chatbotInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
            }
        });
        chatbotInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                updateChatbotSuggestions(chatbotInput.value);
            }, 300);
        });
        chatbotInput.addEventListener('blur', () => {
            setTimeout(() => {
                 if (chatbotSuggestionsArea && !chatbotSuggestionsArea.matches(':hover') && !(document.activeElement && document.activeElement.classList.contains('suggestion-button'))) {
                    chatbotSuggestionsArea.innerHTML = '';
                }
            }, 200);
        });
    }
    
    try {
        await chatbotService.initChatbot();
        fetchNamesForSuggestions(); 
    } catch (error) {
        console.error("Falha ao inicializar o chatbotService no main.js:", error);
        displayChatMessage(`Não foi possível iniciar o assistente: ${error.message}. Verifique sua API Key do Gemini.`, 'bot');
        if (chatbotInput) chatbotInput.disabled = true;
        if (chatbotSendButton) chatbotSendButton.disabled = true;
    }
}

function initHomeView() {
    console.log("Página Inicial carregada.");
}
function initAboutView() {
    console.log("Página Sobre carregada.");
}


function initializeApp() {
    console.log("Inicializando Aplicação...");

    if (typeof marked !== 'undefined' && typeof marked.setOptions === 'function') {
        marked.setOptions({
            breaks: true, 
            gfm: true    
        });
        console.log("Marked.js configurado globalmente.");
    } else {
        console.warn("Marked.js não foi carregado ou 'setOptions' não é uma função. A formatação Markdown no chat pode não funcionar como esperado.");
    }

    ui.showStatusMessage(globalStatusElementId, 'Aplicação carregada.', 'info');
    loadInitialTheme();

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isAnimating) return;
            const pageId = button.getAttribute('data-page');
            navigateTo(pageId);
            if (mainNav && mainNav.classList.contains('mobile-menu-open')) {
                toggleMobileMenu();
            }
        });
    });

    if (hamburgerButton && mainNav) {
        hamburgerButton.addEventListener('click', toggleMobileMenu);
        hamburgerButton.innerHTML = '<svg viewBox="0 0 100 80" width="25" height="25" fill="var(--button-primary-text)"><rect width="100" height="15" rx="8"></rect><rect y="30" width="100" height="15" rx="8"></rect><rect y="60" width="100" height="15" rx="8"></rect></svg>';
    }
    if (darkModeToggleButton) darkModeToggleButton.addEventListener('click', toggleTheme);
    window.addEventListener('scroll', handleScroll);

    if (mainContainer) {
        mainContainer.addEventListener('touchstart', handleTouchStart, { passive: false }); 
        mainContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
    
    initializeChatbotUI(); 

    const initialPage = 'page-home';
    navigateTo(initialPage, null, true);
}

function navigateTo(nextPageId, swipeDirection = null, isInitialLoad = false) {
    if (isAnimating && !isInitialLoad) {
        console.warn("Animação em progresso, navegação ignorada.");
        return;
    }
    if (currentPageId === nextPageId && !isInitialLoad) {
        console.log(`Já está na view: ${nextPageId}`);
        if (nextPageId === 'page-edit') initEditView();
        if (nextPageId === 'page-calculate') initCalculateView();
        if (nextPageId === 'page-insert') initInsertView();
        if (nextPageId === 'page-home') initHomeView();
        if (nextPageId === 'page-about') initAboutView();
        return;
    }

    isAnimating = true;
    const currentPageElement = currentPageId ? pages[currentPageId] : null;
    const nextPageElement = pages[nextPageId];

    if (!nextPageElement) {
        console.error(`Página com ID "${nextPageId}" não encontrada.`);
        ui.showStatusMessage(globalStatusElementId, `Erro: View ${nextPageId} não encontrada.`, 'error');
        isAnimating = false;
        return;
    }

    Object.values(pages).forEach(p => {
        if(p) p.className = 'page-view';
    });
    
    navButtons.forEach(button => button.classList.remove('active'));
    const activeButton = document.querySelector(`#main-nav button[data-page='${nextPageId}']`);
    if (activeButton) activeButton.classList.add('active');

    nextPageElement.style.display = 'block';

    if (isInitialLoad) {
        nextPageElement.classList.add('page-active');
    } else if (currentPageElement && swipeDirection) {
        if (swipeDirection === 'left') {
            currentPageElement.classList.add('page-leave-to-left');
            nextPageElement.classList.add('page-enter-from-right');
        } else {
            currentPageElement.classList.add('page-leave-to-right');
            nextPageElement.classList.add('page-enter-from-left');
        }
        requestAnimationFrame(() => {
            nextPageElement.classList.add('page-animating');
            currentPageElement.classList.add('page-animating');
            requestAnimationFrame(() => {
                nextPageElement.classList.add('page-active');
                currentPageElement.classList.remove('page-active');
            });
        });
    } else if (currentPageElement) {
        currentPageElement.classList.add('page-fade-out');
        nextPageElement.classList.add('page-fade-in-prepare');
        requestAnimationFrame(() => {
            nextPageElement.classList.add('page-animating');
            currentPageElement.classList.add('page-animating');
             requestAnimationFrame(() => {
                nextPageElement.classList.add('page-active');
                currentPageElement.classList.remove('page-active');
             });
        });
    }

    const animationDuration = 300;
    setTimeout(() => {
        if (currentPageElement && !isInitialLoad) {
            currentPageElement.style.display = 'none';
            currentPageElement.className = 'page-view';
        }
        nextPageElement.className = 'page-view page-active';
        currentPageId = nextPageId;
        currentView = nextPageId;
        try {
            switch (nextPageId) {
                case 'page-home': initHomeView(); break;
                case 'page-insert': initInsertView(); break;
                case 'page-calculate': initCalculateView(); break;
                case 'page-edit': initEditView(); break;
                case 'page-about': initAboutView(); break;
                default: console.warn(`Nenhuma ação definida para: ${nextPageId}`);
            }
            ui.showStatusMessage(globalStatusElementId, `View "${nextPageId.replace('page-', '')}" carregada.`, 'info');
        } catch (error) {
            console.error(`Erro ao inicializar view ${nextPageId}:`, error);
            ui.showStatusMessage(globalStatusElementId, `Erro ao carregar view ${nextPageId}.`, 'error');
        }
        isAnimating = false;
    }, animationDuration);
}

function toggleMobileMenu() {
    if (!mainNav || !hamburgerButton) return;
    const isOpen = mainNav.classList.contains('mobile-menu-open');
    mainNav.classList.toggle('mobile-menu-open');
    hamburgerButton.classList.toggle('active'); // A classe .active no botão pode ser usada para animar o SVG se necessário
    hamburgerButton.setAttribute('aria-expanded', String(!isOpen));

    if (isOpen) { 
        hamburgerButton.innerHTML = '<svg viewBox="0 0 100 80" width="25" height="25" fill="var(--button-primary-text)"><rect width="100" height="15" rx="8"></rect><rect y="30" width="100" height="15" rx="8"></rect><rect y="60" width="100" height="15" rx="8"></rect></svg>';
    } else { 
        hamburgerButton.innerHTML = '<svg viewBox="0 0 100 100" width="25" height="25" fill="var(--button-primary-text)"><rect x="10" y="42.5" width="80" height="15" rx="8" transform="rotate(45 50 50)"></rect><rect x="10" y="42.5" width="80" height="15" rx="8" transform="rotate(-45 50 50)"></rect></svg>';
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
/*
  Arquivo: main.js
  Descrição: Este é o arquivo principal de JavaScript para o frontend da aplicação.
  Ele gerencia a inicialização geral da aplicação, a navegação entre as diferentes "páginas" (views),
  o controle do tema (claro/escuro) e a interatividade do menu de navegação (incluindo o menu hambúrguer
  para dispositivos móveis). Também implementa a funcionalidade de swipe para navegação em telas sensíveis ao toque,
  o comportamento de ocultar/mostrar o header ao rolar a página, e a interface/lógica do chatbot.
  Principais Funções:
  - initializeApp: Ponto de entrada que configura os listeners de eventos globais, carrega a view inicial e inicializa o chatbot.
  - navigateTo: Controla a transição animada entre as diferentes views (Inserir, Calcular, Editar).
  - applyTheme, toggleTheme, loadInitialTheme: Gerenciam a aplicação do tema claro/escuro.
  - handleScroll: Oculta/mostra o header ao rolar a página.
  - handleTouchStart, handleTouchEnd, handleSwipeGesture: Implementam navegação por swipe.
  - toggleMobileMenu: Controla o menu de navegação mobile.
  - initializeChatbotUI: Configura listeners para a UI do chat e interações com o chatbotService.
  - toggleChatbotWindow: Alterna a visibilidade da janela do chatbot.
  - displayChatMessage: Adiciona uma mensagem (usuário ou bot) na área de mensagens do chat.
  - handleSendMessage: Pega a mensagem do usuário, envia para o chatbotService e exibe as respostas.
  Módulos Importados:
  - initInsertView, initCalculateView, initEditView: Funções de inicialização para cada view específica.
  - ui (de ui.js): Funções utilitárias para a UI.
  - chatbotService (de services/chatbotService.js): Lógica de comunicação com o Gemini.
  Constantes Globais:
  - Elementos DOM para páginas, navegação, header, container e chatbot.
*/
import { initInsertView } from './views/insertView.js'; //
import { initCalculateView } from './views/calculateView.js'; //
import { initEditView } from './views/editView.js'; //
import * as ui from './ui.js'; //
import * as chatbotService from './services/chatbotService.js';

const pages = {
    'page-insert': document.getElementById('page-insert'),
    'page-calculate': document.getElementById('page-calculate'),
    'page-edit': document.getElementById('page-edit')
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
const chatbotCloseButton = document.getElementById('chatbot-close-button');
const chatbotMessagesArea = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendButton = document.getElementById('chatbot-send-button');

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
    if (isChatbotOpen && chatbotWindow && chatbotWindow.contains(event.target)) return;
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
}

function handleTouchEnd(event) {
    if (isAnimating) return;
    if (isChatbotOpen && chatbotWindow && chatbotWindow.contains(event.target)) return;
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

function displayChatMessage(message, type = 'bot') {
    if (!chatbotMessagesArea) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chatbot-message', type);
    // Para renderizar Markdown básico (negrito, itálico, listas, links) de forma segura
    // Você pode usar uma biblioteca como 'marked' ou um sanitizador DOM mais robusto se precisar de HTML complexo.
    // Por simplicidade, vamos apenas setar textContent por enquanto, ou um innerHTML simples para quebras de linha.
    // Para markdown mais completo, você precisaria parsear `message` e construir o HTML.
    // Exemplo simples para quebras de linha:
    messageDiv.innerHTML = message.replace(/\n/g, '<br>'); // Simples, cuidado com XSS se a mensagem vier de fontes não confiáveis diretamente.
                                                        // A resposta do Gemini deve ser segura, mas é bom ter em mente.
    chatbotMessagesArea.appendChild(messageDiv);
    chatbotMessagesArea.scrollTop = chatbotMessagesArea.scrollHeight; // Auto-scroll
}

async function handleSendMessage() {
    if (!chatbotInput || !chatbotSendButton || isChatbotProcessing) return;
    const messageText = chatbotInput.value.trim();
    if (!messageText) return;

    displayChatMessage(messageText, 'user');
    chatbotInput.value = '';
    chatbotInput.disabled = true;
    chatbotSendButton.disabled = true;
    isChatbotProcessing = true;
    displayChatMessage("Pensando...", 'bot-typing'); // Feedback de digitação

    try {
        const response = await chatbotService.sendMessageToGemini(messageText);
        const typingIndicator = chatbotMessagesArea.querySelector('.bot-typing');
        if(typingIndicator) typingIndicator.remove();

        if (response.text) {
            displayChatMessage(response.text, 'bot');
        } else if (response.error) {
            displayChatMessage(`Desculpe, ocorreu um erro: ${response.error}`, 'bot');
            console.error("Erro do chatbotService:", response.error);
        } else {
            displayChatMessage("Não obtive uma resposta clara, tente novamente.", 'bot');
        }
    } catch (error) {
        const typingIndicator = chatbotMessagesArea.querySelector('.bot-typing');
        if(typingIndicator) typingIndicator.remove();
        displayChatMessage(`Erro crítico ao processar sua mensagem: ${error.message}`, 'bot');
        console.error("Erro em handleSendMessage:", error);
    } finally {
        chatbotInput.disabled = false;
        chatbotSendButton.disabled = false;
        isChatbotProcessing = false;
        chatbotInput.focus();
    }
}


function toggleChatbotWindow() {
    if (!chatbotWindow || !chatbotToggleButton) return;
    isChatbotOpen = !isChatbotOpen;
    if (isChatbotOpen) {
        chatbotWindow.style.display = 'flex';
        setTimeout(() => chatbotWindow.classList.add('active'), 10);
        chatbotToggleButton.setAttribute('aria-expanded', 'true');
        chatbotToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';
        chatbotInput.focus();
    } else {
        chatbotWindow.classList.remove('active');
        chatbotToggleButton.setAttribute('aria-expanded', 'false');
        chatbotToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12zM7 9h10v2H7zm0 3h7v2H7z"/></svg>';
        setTimeout(() => {
            if (!isChatbotOpen) chatbotWindow.style.display = 'none';
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

    if (chatbotSendButton && chatbotInput) {
        chatbotSendButton.addEventListener('click', handleSendMessage);
        chatbotInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) { // Envia com Enter, permite Shift+Enter para nova linha
                event.preventDefault(); // Previne nova linha no input se não for Shift+Enter
                handleSendMessage();
            }
        });
    }
    
    try {
        await chatbotService.initChatbot();
        // A mensagem inicial do bot já é adicionada no HTML,
        // mas você pode querer uma mensagem dinâmica após a inicialização bem-sucedida.
        // displayChatMessage("Olá! Sou o RaitoCraft Assistant. Como posso ajudar?", 'bot');
    } catch (error) {
        console.error("Falha ao inicializar o chatbotService no main.js:", error);
        displayChatMessage(`Não foi possível iniciar o assistente: ${error.message}. Verifique sua API Key do Gemini.`, 'bot');
        if (chatbotInput) chatbotInput.disabled = true;
        if (chatbotSendButton) chatbotSendButton.disabled = true;
    }
}

function initializeApp() {
    console.log("Inicializando Aplicação...");
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

    if (hamburgerButton && mainNav) hamburgerButton.addEventListener('click', toggleMobileMenu);
    if (darkModeToggleButton) darkModeToggleButton.addEventListener('click', toggleTheme);
    window.addEventListener('scroll', handleScroll);

    if (mainContainer) {
        mainContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        mainContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    initializeChatbotUI(); 

    const initialPage = 'page-calculate';
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
                case 'page-insert': initInsertView(); break;
                case 'page-calculate': initCalculateView(); break;
                case 'page-edit': initEditView(); break;
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
    hamburgerButton.classList.toggle('active');
    hamburgerButton.setAttribute('aria-expanded', String(!isOpen));
}

document.addEventListener('DOMContentLoaded', initializeApp);
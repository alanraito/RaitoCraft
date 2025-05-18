/*
  Arquivo: main.js
  Descrição: Este é o arquivo principal de JavaScript para o frontend da aplicação.
  Ele gerencia a inicialização geral da aplicação, a navegação entre as diferentes "páginas" (views),
  o controle do tema (claro/escuro) e a interatividade do menu de navegação (incluindo o menu hambúrguer
  para dispositivos móveis). Também implementa a funcionalidade de swipe para navegação em telas sensíveis ao toque
  e o comportamento de ocultar/mostrar o header ao rolar a página.
  Principais Funções:
  - initializeApp: Ponto de entrada que configura os listeners de eventos globais e carrega a view inicial.
  - navigateTo: Controla a transição animada entre as diferentes views (Inserir, Calcular, Editar).
                Suporta animações de fade (para cliques) e swipe (para gestos de toque).
  - applyTheme, toggleTheme, loadInitialTheme: Gerenciam a aplicação do tema claro/escuro e persistem
                                               a preferência do usuário no localStorage.
  - handleScroll: Oculta o header principal ao rolar a página para baixo e o exibe ao rolar para cima.
  - handleTouchStart, handleTouchEnd, handleSwipeGesture: Implementam a navegação por gestos de swipe
                                                          entre as páginas em dispositivos móveis.
  - toggleMobileMenu: Controla a abertura e fechamento do menu de navegação mobile (hambúrguer).
  Módulos Importados:
  - initInsertView, initCalculateView, initEditView: Funções de inicialização para cada view específica.
  - ui (de ui.js): Funções utilitárias para interações com a interface do usuário, como exibir mensagens de status.
  Constantes Globais:
  - pages: Objeto que mapeia IDs de página para seus respectivos elementos DOM.
  - navButtons: Coleção de botões de navegação principal.
  - Outras constantes para elementos DOM frequentemente acessados (header, container principal, etc.).
*/
import { initInsertView } from './views/insertView.js';
import { initCalculateView } from './views/calculateView.js';
import { initEditView } from './views/editView.js';
import * as ui from './ui.js';

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

let currentView = null;
let currentPageId = null;
let isAnimating = false;

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
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
}

function handleTouchEnd(event) {
    if (isAnimating) return;
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
                if (swipeDirection === 'left') {
                    currentPageElement.classList.remove('page-active');
                } else {
                    currentPageElement.classList.remove('page-active');
                }
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
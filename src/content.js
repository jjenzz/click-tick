(function (window) {
  const PRIMARY_COLOR = '#32CD32';

  function main() {
    window.clickTick ??= new ClickTick();
  }

  /* -------------------------------------------------------------------------------------------------
   * ClickTick
   * -----------------------------------------------------------------------------------------------*/

  class ClickTick {
    constructor() {
      this.currentUrl = window.location.href;
      this.isActive = false;
      this.timingBox = null;
      this.cursorRing = null;
      this.activeObservers = new Map();
      this.activeTimeouts = new Map();
      this.isTracking = false;
      this.setupMessageListener();
      this.init();
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        if (message.action === 'getState') {
          sendResponse({ isActive: this.isActive });
          return true;
        } else if (message.action === 'activate') {
          this.start();
        } else if (message.action === 'deactivate') {
          this.stop();
        }
      });
    }

    init() {
      this.timingBox ??= new TimingBox();
      this.cursorRing ??= new CursorRing();
      this.timingBox.show();
    }

    calculateFrames(ms) {
      return {
        fps60: (ms / 16.6667).toFixed(2),
        fps120: (ms / 8.3333).toFixed(2),
      };
    }

    cleanupAllEvents() {
      for (const [eventType, observer] of this.activeObservers.entries()) {
        observer.disconnect();
        this.activeObservers.delete(eventType);
      }

      for (const [eventType, timeout] of this.activeTimeouts.entries()) {
        clearTimeout(timeout);
        this.activeTimeouts.delete(eventType);
      }
    }

    cleanupEvent(eventType) {
      const observer = this.activeObservers.get(eventType);
      if (observer) {
        observer.disconnect();
        this.activeObservers.delete(eventType);
      }

      const timeout = this.activeTimeouts.get(eventType);
      if (timeout) {
        clearTimeout(timeout);
        this.activeTimeouts.delete(eventType);
      }
    }

    handlePointerDown(event) {
      if (event.button !== 0 || this.timingBox.box.contains(event.target)) return;
      this.cleanupAllEvents();
      this.trackNavigation(event);
      this.cursorRing.show({ x: event.clientX, y: event.clientY }, 'white');
      this.isTracking = true;
    }

    handlePointerUp(event) {
      const ringCoords = { x: event.clientX, y: event.clientY };
      const prevTimeout = this.activeTimeouts.get('cursor-ring');
      if (prevTimeout) clearTimeout(prevTimeout);

      const timeout = setTimeout(() => this.cursorRing.hide(), 350);
      this.activeTimeouts.set('cursor-ring', timeout);

      if (!this.isTracking) return;
      this.trackNavigation(event);
      this.cursorRing.show({ ...ringCoords, width: 25, height: 25 }, PRIMARY_COLOR);
      this.isTracking = false;
    }

    trackNavigation(event) {
      this.cleanupEvent(event.type);
      this.timingBox.loading(event.type);

      const timeout = setTimeout(() => {
        this.cleanupEvent(event.type);
        this.timingBox.showNoNavMessage(event.type);
      }, 2000);

      const startTime = performance.now();
      this.currentUrl = window.location.href;

      const observer = new MutationObserver(() => {
        if (window.location.href === this.currentUrl) return;

        const endTime = performance.now();
        const elapsedMs = endTime - startTime;
        const frames = this.calculateFrames(elapsedMs);

        this.cleanupEvent(event.type);
        this.timingBox.updateSection(event.type, elapsedMs, frames);
      });

      this.activeObservers.set(event.type, observer);
      this.activeTimeouts.set(event.type, timeout);

      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    start() {
      if (this.isActive) return;
      this.isActive = true;
      document.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      document.addEventListener('pointerup', this.handlePointerUp.bind(this));
      this.init();
    }

    stop() {
      if (!this.isActive) return;
      this.isActive = false;

      document.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
      document.removeEventListener('pointerup', this.handlePointerUp.bind(this));

      this.cleanupAllEvents();
      this.timingBox?.remove();
      this.cursorRing?.remove();
      this.timingBox = null;
      this.cursorRing = null;
      this.isTracking = false;
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * TimingBox
   * -----------------------------------------------------------------------------------------------*/

  class TimingBox {
    constructor() {
      this.box = this.createBox();
      this.sections = {
        pointerdown: this.createSection('pointerdown'),
        pointerup: this.createSection('pointerup'),
      };
      this.initializeBox();
    }

    createBox() {
      const box = document.createElement('div');
      box.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: ${PRIMARY_COLOR};
      padding: 12px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 9999;
      min-width: 200px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      cursor: move;
      user-select: none;
      display: none;
    `;
      box.setAttribute('data-clicktick', 'true');

      // Add animation styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes clicktick-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .clicktick-pulse {
          animation: clicktick-pulse 1s infinite;
        }
      `;
      document.head.appendChild(style);

      return box;
    }

    createSection(eventType) {
      const section = document.createElement('div');
      section.id = `clicktick-${eventType}`;
      section.style.marginBottom = '8px';
      section.style.paddingBottom = '8px';
      section.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';

      const heading = document.createElement('div');
      heading.setAttribute('data-clicktick-event-type', eventType);
      heading.style.color = 'white';
      heading.style.fontWeight = 'bold';
      heading.style.marginBottom = '4px';
      heading.textContent = eventType;

      const ms = document.createElement('div');
      const fps60 = document.createElement('div');
      const fps120 = document.createElement('div');
      ms.textContent = 'No nav detected';

      section.appendChild(heading);
      section.appendChild(ms);
      section.appendChild(fps60);
      section.appendChild(fps120);

      return {
        element: section,
        heading,
        ms,
        fps60,
        fps120,
      };
    }

    initializeBox() {
      this.box.appendChild(this.sections.pointerdown.element);
      this.box.appendChild(this.sections.pointerup.element);
      document.body.appendChild(this.box);
      this.setupDraggable();
    }

    setupDraggable() {
      let isDragging = false;
      let currentX;
      let currentY;
      let initialX;
      let initialY;
      let xOffset = 0;
      let yOffset = 0;

      this.box.addEventListener('pointerdown', (e) => {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (this.box.contains(e.target)) {
          isDragging = true;
          document.addEventListener('mousemove', drag);
          document.addEventListener('pointerup', dragEnd);
        }
      });

      const drag = (e) => {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;

          xOffset = currentX;
          yOffset = currentY;

          this.box.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
      };

      const dragEnd = () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('pointerup', dragEnd);
      };
    }

    updateSection(eventType, elapsedMs, frames) {
      const section = this.sections[eventType];
      if (!section) return;

      section.ms.textContent = `${elapsedMs.toFixed(2)}ms`;
      section.fps60.textContent = `${frames.fps60}f @60fps`;
      section.fps120.textContent = `${frames.fps120}f @120fps`;
      this.ready(eventType);
    }

    showNoNavMessage(eventType) {
      const section = this.sections[eventType];
      if (!section) return;

      section.heading.classList.remove('clicktick-pulse');
      section.ms.textContent = 'No nav detected';
      section.fps60.textContent = '';
      section.fps120.textContent = '';
      this.ready(eventType);
    }

    remove() {
      if (this.box && this.box.parentNode) {
        this.box.parentNode.removeChild(this.box);
      }
    }

    show() {
      if (this.box) {
        this.box.style.display = 'block';
      }
    }

    loading(eventType) {
      const section = this.sections[eventType];
      section?.heading.classList.add('clicktick-pulse');
    }

    ready(eventType) {
      const section = this.sections[eventType];
      section?.heading.classList.remove('clicktick-pulse');
      this.show();
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * CursorRing
   * -----------------------------------------------------------------------------------------------*/

  class CursorRing {
    constructor() {
      this.ring = this.createRing();
      this.initializeRing();
    }

    createRing() {
      const ring = document.createElement('div');
      ring.style.cssText = `
      position: fixed;
      pointer-events: none;
      width: 25px;
      height: 25px;
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      transform-origin: center;
      transition-property: width, height, opacity;
      z-index: 9999;
    `;
      return ring;
    }

    initializeRing() {
      document.body.appendChild(this.ring);
    }

    show(rect, color) {
      this.ring.style.left = `${rect.x}px`;
      this.ring.style.top = `${rect.y}px`;
      this.ring.style.width = `${rect.width ?? 20}px`;
      this.ring.style.height = `${rect.height ?? 20}px`;
      this.ring.style.borderColor = color;
      this.ring.style.opacity = '1';
    }

    hide() {
      this.ring.style.opacity = '0';
    }

    remove() {
      if (this.ring && this.ring.parentNode) {
        this.ring.parentNode.removeChild(this.ring);
      }
    }
  }

  main();
})(window);

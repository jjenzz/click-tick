class ClickTick {
  constructor() {
    this.isActive = false;
    this.timingBox = null;
    this.activeObservers = new Map();
    this.activeTimeouts = new Map();
    this.cursorRing = null;
    this.mouseDownRing = null;
    this.initialize();
  }

  initialize() {
    this.setupMessageListener();
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

  createTimingBox() {
    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 9999;
      min-width: 200px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      cursor: move;
      user-select: none;
    `;
    box.setAttribute('data-clicktick', 'true');

    const mousedownSection = document.createElement('div');
    mousedownSection.id = 'clicktick-mousedown';
    mousedownSection.style.marginBottom = '8px';
    mousedownSection.style.paddingBottom = '8px';
    mousedownSection.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';

    const mouseupSection = document.createElement('div');
    mouseupSection.id = 'clicktick-mouseup';

    box.appendChild(mousedownSection);
    box.appendChild(mouseupSection);

    this.setupDraggable(box);
    return box;
  }

  setupDraggable(box) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    box.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (box.contains(e.target)) {
        isDragging = true;
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
      }
    });

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        box.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    };

    const dragEnd = () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
    };
  }

  updateTimingDisplay(eventType, elapsedMs, frames) {
    const section = document.getElementById(`clicktick-${eventType}`);
    if (!section) return;

    section.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${eventType}</div>
      <div style="color: #32CD32;">${elapsedMs.toFixed(2)}ms</div>
      <div style="color: #32CD32;">${frames.fps60}f @60fps</div>
      <div style="color: #32CD32;">${frames.fps120}f @120fps</div>
    `;
  }

  calculateFrames(ms) {
    return {
      fps60: Math.ceil(ms / 16.6667),
      fps120: Math.ceil(ms / 8.3333),
    };
  }

  isNavigationMutation(mutation) {
    const target = mutation.target;

    // Ignore our own extension's elements
    if (target.hasAttribute('data-clicktick')) return false;

    // Check if the mutation target is or is within an interactive element
    // (assumption is that the interative element swaps to an active state if
    // it is the active page)
    const isInteractive = target.closest('a, button, [role="button"], [onclick]');
    if (!isInteractive) return false;

    // Check for any changes to the interactive element
    return (
      mutation.type === 'attributes' ||
      mutation.type === 'characterData' ||
      (mutation.type === 'childList' && mutation.addedNodes.length > 0)
    );
  }

  initializeTimingBox() {
    if (!this.timingBox) {
      this.timingBox = this.createTimingBox();
      document.body.appendChild(this.timingBox);
      this.updateNoNavMessage('mousedown');
      this.updateNoNavMessage('mouseup');
    }
  }

  updateNoNavMessage(eventType) {
    const section = document.getElementById(`clicktick-${eventType}`);
    if (section) {
      section.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${eventType}</div>
        <div style="color: #32CD32;">No nav detected</div>
      `;
    }
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

  createCursorRing() {
    const cursorRing = document.createElement('div');
    cursorRing.style.cssText = `
      position: fixed;
      pointer-events: none;
      width: 40px;
      height: 40px;
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 0.2s ease-out;
      z-index: 9999;
    `;
    document.body.appendChild(cursorRing);
    return cursorRing;
  }

  showCursorRing(coords, color) {
    const ring = this.cursorRing ??= this.createCursorRing();
    ring.style.left = `${coords.x}px`;
    ring.style.top = `${coords.y}px`;
    ring.style.borderColor = color;
    ring.style.opacity = '1';
    return ring;
  }

  handleMouseEvent(event) {
    if (!this.isActive) return;

    const target = event.target;
    const isInteractive = target.closest('a, button, [role="button"], [onclick]');

    if (!isInteractive) return;

    const eventType = event.type;
    const startTime = performance.now();
    const ringCoords = { x: event.clientX, y: event.clientY };

    if (eventType === 'mousedown') {
      this.showCursorRing(ringCoords, 'white');
      this.cleanupAllEvents();
    } else {
      const ring = this.showCursorRing(ringCoords, '#32CD32'); // Lime green
      const existingTimeout = this.activeTimeouts.get('cursorRing');
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(() => {
        ring.style.opacity = '0';
      }, 350);

      this.cleanupEvent(eventType);
      this.activeTimeouts.set('cursorRing', timeout);
    }

    this.initializeTimingBox();

    const observer = new MutationObserver((mutations) => {
      const hasNavigationMutation = mutations.some(this.isNavigationMutation);

      if (hasNavigationMutation) {
        this.cleanupEvent(eventType);

        const endTime = performance.now();
        const elapsedMs = endTime - startTime;
        const frames = this.calculateFrames(elapsedMs);

        this.updateTimingDisplay(eventType, elapsedMs, frames);
      }
    });

    this.activeObservers.set(eventType, observer);

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const timeout = setTimeout(() => {
      this.cleanupEvent(eventType);
      this.updateNoNavMessage(eventType);
    }, 2000);

    this.activeTimeouts.set(eventType, timeout);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    document.addEventListener('mousedown', this.handleMouseEvent.bind(this));
    document.addEventListener('mouseup', this.handleMouseEvent.bind(this));

    this.initializeTimingBox();
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;

    document.removeEventListener('mousedown', this.handleMouseEvent.bind(this));
    document.removeEventListener('mouseup', this.handleMouseEvent.bind(this));

    this.cleanupAllEvents();

    const box = document.querySelector('[data-clicktick="true"]');

    if (box) {
      box.remove();
      this.timingBox = null;
    }

    // Clean up cursor rings
    if (this.cursorRing) {
      this.cursorRing.remove();
      this.cursorRing = null;
    }
  }
}

if (!window.clickTickInitialized) {
  window.clickTickInitialized = true;
  // Initialize the extension
  window.clickTick = new ClickTick();
}

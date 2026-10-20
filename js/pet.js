const IDLE_FRAMES = ['./pet/sprite-1.png'];
const TYPING_FRAMES = ['./pet/sprite-6.png', './pet/sprite-5.png'];
const SURPRISED = './pet/sprite-2.png';
const CONFUSED = './pet/sprite-3.png';
const HAPPY = './pet/sprite-4.png';

const IDLE_FRAME_MS = 1600;
const TYPING_HOLD_MS = 700;
const REACTION_MS = 1100;
const HAPPY_MS = 1600;

function init() {
    const pet = document.getElementById('typing-pet');
    if (!pet) return;

    const handle = pet.querySelector('.typing-pet-drag');
    const img = pet.querySelector('img');

    let mode = 'idle';
    let idleFrame = 0;
    let typingFrame = 0;
    let idleTimer = null;
    let holdTimer = null;
    let reactionTimer = null;

    function setPose(src) {
        img.src = src;
    }

    function startIdle() {
        clearInterval(idleTimer);
        setPose(IDLE_FRAMES[idleFrame % IDLE_FRAMES.length]);
        idleTimer = setInterval(() => {
            idleFrame++;
            if (mode === 'idle') setPose(IDLE_FRAMES[idleFrame % IDLE_FRAMES.length]);
        }, IDLE_FRAME_MS);
    }

    function returnToIdle() {
        mode = 'idle';
        setPose(IDLE_FRAMES[idleFrame % IDLE_FRAMES.length]);
    }

    function tap() {
        img.classList.remove('tap');
        void img.offsetWidth;
        img.classList.add('tap');
    }

    function onKeyDown(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        if (event.key === 'Enter') {
            clearTimeout(holdTimer);
            clearTimeout(reactionTimer);
            mode = 'reaction';
            setPose(SURPRISED);
            tap();
            reactionTimer = setTimeout(returnToIdle, REACTION_MS);
        } else if (event.key === 'Backspace' || event.key === 'Delete') {
            clearTimeout(holdTimer);
            clearTimeout(reactionTimer);
            mode = 'reaction';
            setPose(CONFUSED);
            tap();
            reactionTimer = setTimeout(returnToIdle, REACTION_MS);
        } else if (event.key === ' ') {
            clearTimeout(holdTimer);
            clearTimeout(reactionTimer);
            mode = 'reaction';
            setPose(HAPPY);
            tap();
            reactionTimer = setTimeout(returnToIdle, HAPPY_MS);
        } else if (event.key.length === 1) {
            if (mode === 'reaction') return;
            clearTimeout(reactionTimer);
            mode = 'typing';
            typingFrame++;
            setPose(TYPING_FRAMES[typingFrame % TYPING_FRAMES.length]);
            tap();
            clearTimeout(holdTimer);
            holdTimer = setTimeout(returnToIdle, TYPING_HOLD_MS);
        }
    }

    let drag = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragFrame = null;

    function applyDrag() {
        dragFrame = null;
        if (!drag) return;
        let dx = drag.pointerX - drag.startX;
        let dy = drag.pointerY - drag.startY;
        const maxLeft = window.innerWidth - drag.width;
        const maxTop = window.innerHeight - drag.height;
        dx = Math.min(Math.max(dx, -drag.rectLeft), maxLeft - drag.rectLeft);
        dy = Math.min(Math.max(dy, -drag.rectTop), maxTop - drag.rectTop);
        drag.dx = dx;
        drag.dy = dy;
        handle.style.transform = `translate3d(${offsetX + dx}px, ${offsetY + dy}px, 0)`;
    }

    handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const rect = handle.getBoundingClientRect();
        drag = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            pointerX: event.clientX,
            pointerY: event.clientY,
            rectLeft: rect.left,
            rectTop: rect.top,
            width: rect.width,
            height: rect.height,
            dx: 0,
            dy: 0,
        };
        handle.classList.add('is-dragging');
        pet.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        drag.pointerX = event.clientX;
        drag.pointerY = event.clientY;
        if (dragFrame === null) dragFrame = requestAnimationFrame(applyDrag);
    });

    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        if (dragFrame !== null) {
            cancelAnimationFrame(dragFrame);
            dragFrame = null;
            applyDrag();
        }
        offsetX += drag.dx;
        offsetY += drag.dy;
        drag = null;
        handle.classList.remove('is-dragging');
        pet.classList.remove('is-dragging');
    }

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    document.addEventListener('keydown', onKeyDown);
    startIdle();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

let audioContext = null;
        function getAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
            return audioContext;
        }
        const initializeAudio = () => {
            getAudioContext();
            window.removeEventListener('mousedown', initializeAudio, true);
            window.removeEventListener('keydown', initializeAudio, true);
            window.removeEventListener('touchstart', initializeAudio, true);
        };
        window.addEventListener('mousedown', initializeAudio, true);
        window.addEventListener('keydown', initializeAudio, true);
        window.addEventListener('touchstart', initializeAudio, { capture: true, passive: true });
        const customCursor = document.getElementById('custom-cursor');
        const startupCurtain = document.getElementById('startup-curtain');
        const startupPending = new Set(['window', 'fonts', 'models']);
        let startupRevealStarted = false;

        function revealStartupCurtain() {
            if (startupRevealStarted || !startupCurtain) return;
            startupRevealStarted = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(() => startupCurtain.classList.add('is-ready'), 120);
                });
            });
        }

        function markStartupReady(task) {
            startupPending.delete(task);
            if (startupPending.size === 0) revealStartupCurtain();
        }

        if (document.readyState === 'complete') {
            markStartupReady('window');
        } else {
            window.addEventListener('load', () => markStartupReady('window'), { once: true });
        }

        if (document.fonts?.ready) {
            document.fonts.ready.then(
                () => markStartupReady('fonts'),
                () => markStartupReady('fonts')
            );
        } else {
            markStartupReady('fonts');
        }

        startupCurtain?.addEventListener('animationend', () => startupCurtain.remove(), { once: true });
        setTimeout(revealStartupCurtain, 8000);

        async function loadKanjiStrokes() {
            const kanjiElements = document.querySelectorAll('.kanji-strokes');
            await Promise.all(Array.from(kanjiElements, async (svg) => {
                try {
                    const response = await fetch(svg.dataset.src);
                    if (!response.ok) throw new Error(`Kanji SVG ${response.status}`);
                    const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
                    const paths = Array.from(source.querySelectorAll('[id*="StrokePaths"] path'));
                    let delay = 0.2;

                    paths.forEach((sourcePath) => {
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('d', sourcePath.getAttribute('d'));
                        path.setAttribute('pathLength', '1');
                        svg.appendChild(path);

                        const length = sourcePath.getAttribute('d').length;
                        const duration = Math.min(0.13, Math.max(0.055, length / 950));
                        path.style.setProperty('--stroke-delay', `${delay.toFixed(3)}s`);
                        path.style.setProperty('--stroke-duration', `${duration.toFixed(3)}s`);
                        delay += duration + 0.018;
                    });
                } catch (error) {
                    console.warn('Could not load kanji strokes:', error);
                }
            }));
        }
        loadKanjiStrokes();

        const clockWidget = document.querySelector('.p5-clock-widget');
        async function lockClockDimensions() {
            if (!clockWidget) return;
            if (document.fonts?.ready) await document.fonts.ready;

            clockWidget.style.width = '';
            clockWidget.style.height = '';
            clockWidget.style.boxSizing = '';

            const { width, height } = clockWidget.getBoundingClientRect();
            clockWidget.style.boxSizing = 'border-box';
            clockWidget.style.width = `${width}px`;
            clockWidget.style.height = `${height}px`;
        }
        lockClockDimensions();

        let clockResizeFrame = 0;
        window.addEventListener('resize', () => {
            cancelAnimationFrame(clockResizeFrame);
            clockResizeFrame = requestAnimationFrame(lockClockDimensions);
        });

        const parallaxLayers = document.querySelectorAll('.parallax-layer');
        const parallaxItems = Array.from(parallaxLayers).map(layer => ({
            el: layer,
            speed: parseFloat(layer.getAttribute('data-speed')),
            constrain: layer.hasAttribute('data-constrain')
        }));

        function playSound() {
            const context = getAudioContext();
            if (!context || context.state !== 'running') return;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1200, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, context.currentTime + 0.03);
            gainNode.gain.setValueAtTime(0.08, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.03);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.03);
        }

        function playTypeSound() {
            const context = getAudioContext();
            if (!context || context.state !== 'running') return;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1600, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1000, context.currentTime + 0.02);
            gainNode.gain.setValueAtTime(0.04, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.02);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.02);
        }

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let previousMouseX = mouseX;
        let previousMouseY = mouseY;
        let mouseVelocityX = 0, mouseVelocityY = 0;

        const trailParticleCount = 30;
        const trailPool = [];
        let nextTrailIndex = 0;
        
        const trailColors = ['#39C5BB', '#ff66aa', '#7be0d9', '#ff9ac8', '#ffffff', '#2fb3aa'];
        const cursorColor = '#ffffff';
        const cursorGlow = 'rgba(255,255,255,1)';

        for (let index = 0; index < trailParticleCount; index++) {
            const particle = document.createElement('div');
            particle.classList.add('trail-particle');
            particle.style.display = 'none';
            document.body.appendChild(particle);
            trailPool.push(particle);
        }

        function showTrailParticle(cursorX, cursorY) {
            const particle = trailPool[nextTrailIndex];
            nextTrailIndex = (nextTrailIndex + 1) % trailParticleCount;
            const color = trailColors[Math.floor(Math.random() * trailColors.length)];
            const offsetX = (Math.random() * 8) - 4;
            const offsetY = (Math.random() * 8) - 4;
            particle.style.cssText = `display:block;left:${cursorX - 3 + offsetX}px;top:${cursorY - 3 + offsetY}px;background:${color};box-shadow:0 0 5px ${color};opacity:0.8;`;
            particle.getAnimations().forEach(animation => animation.cancel());
            particle.animate(
                [{ opacity: 0.8, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0)' }],
                { duration: 800, fill: 'forwards', easing: 'ease' }
            );
        }

        let cursorFramePending = false;
        let cursorClientX = mouseX;
        let cursorClientY = mouseY;
        let cursorTarget = document.body;

        document.addEventListener('mousemove', (e) => {
            previousMouseX = mouseX;
            previousMouseY = mouseY;
            mouseX = e.pageX;
            mouseY = e.pageY;
            mouseVelocityX = mouseX - previousMouseX;
            mouseVelocityY = mouseY - previousMouseY;

            cursorClientX = e.clientX;
            cursorClientY = e.clientY;
            cursorTarget = e.target;

            if (!cursorFramePending) {
                cursorFramePending = true;
                requestAnimationFrame(() => {
                    cursorFramePending = false;
                    customCursor.style.left = `${cursorClientX}px`;
                    customCursor.style.top = `${cursorClientY}px`;
                    updateCursorColor(cursorTarget);
                    if (Math.random() > 0.75) showTrailParticle(cursorClientX, cursorClientY);
                });
            }
            requestParallaxUpdate();
        }, { passive: true });

        function updateCursorColor(el) {
            if (!el || typeof el.closest !== 'function') return;

            const overInteractive = el.closest(
                '.bg-btn, .social-btn, .p5-clock-widget, .dialogue-box, .model-container, .avatar-circle, .screen-pet, a, button'
            );

            if (overInteractive) {
                customCursor.style.background = 'white';
                customCursor.style.boxShadow = '0 0 15px white';
            } else {
                customCursor.style.background = cursorColor;
                customCursor.style.boxShadow = `0 0 16px ${cursorGlow}`;
            }
        }

        document.addEventListener('mousedown', (event) => {
            if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
            customCursor.classList.add('clicking');
            customCursor.classList.remove('ripple-active');
            void customCursor.offsetHeight;
            customCursor.classList.add('ripple-active');
            const clickedPet = event.target?.closest?.('.screen-pet');
            if (!clickedPet) playSound();
        });

        document.addEventListener('mouseup', () => {
            customCursor.classList.remove('clicking');
        });

        function setupHoverSFX() {
            const hoverSoundTargets = document.querySelectorAll('.sfx-hover, a, button, .bg-btn, .social-btn, .avatar-circle, .dialogue-box');
            hoverSoundTargets.forEach(element => {
                element.addEventListener('mouseenter', () => playSound());
            });
        }
        setupHoverSFX();

        import { backgrounds, copyrightInfo, reactionGifs } from './content.js?v=27';
        import { dialogues } from './dialogues.js?v=16';

        let currentDialogueIndex = 0;
        let currentGifIndex = 0;
        let isTyping = false;
        let skipTyping = false;
        let isChangingGif = false;
        let typingTimer = null;

        function setSpeakerLabel(element, speaker) {
            element.textContent = speaker;
            element.dataset.speaker = speaker.toLowerCase();
        }

        setSpeakerLabel(document.getElementById('speaker-label'), dialogues[0].speaker);
        document.getElementById('dialogue-text').textContent = dialogues[0].text;

        function typeWriter(element, text, speed = 30) {
            return new Promise((resolve) => {
                element.textContent = '';
                let i = 0;
                function type() {
                    if (skipTyping) {
                        element.textContent = text;
                        resolve();
                        return;
                    }
                    if (i < text.length) {
                        element.textContent += text.charAt(i);
                        if (text.charAt(i) !== ' ') playTypeSound();
                        i++;
                        typingTimer = setTimeout(type, speed);
                    } else {
                        resolve();
                    }
                }
                type();
            });
        }

        async function advanceDialogue() {
            if (isTyping) {
                skipTyping = true;
                return;
            }

            skipTyping = false;
            isTyping = true;
            currentDialogueIndex = (currentDialogueIndex + 1) % dialogues.length;
            const dialogue = dialogues[currentDialogueIndex];
            const speakerLabel = document.getElementById('speaker-label');
            const dialogueText = document.getElementById('dialogue-text');

            speakerLabel.style.opacity = '0';
            dialogueText.style.opacity = '0';

            await new Promise(resolve => setTimeout(resolve, 300));
            setSpeakerLabel(speakerLabel, dialogue.speaker);
            speakerLabel.style.opacity = '1';
            await new Promise(resolve => setTimeout(resolve, 100));
            dialogueText.style.opacity = '1';

            await typeWriter(dialogueText, dialogue.text);
            isTyping = false;
            skipTyping = false;
        }

        const avatarImage = document.getElementById('avatar-image');
        const gifImage = document.getElementById('gif-image');
        const avatarSpinner = document.getElementById('avatar-spinner');

        function showRandomGif(attemptsLeft = reactionGifs.length) {
            if (isChangingGif) return;
            isChangingGif = true;

            avatarSpinner.classList.add('visible');
            avatarImage.classList.add('hidden');
            gifImage.classList.add('hidden');
            gifImage.classList.remove('active');

            const gifUrl = reactionGifs[currentGifIndex];

            gifImage.onload = () => {
                currentGifIndex = (currentGifIndex + 1) % reactionGifs.length;

                avatarSpinner.classList.remove('visible');
                gifImage.classList.remove('hidden');
                gifImage.classList.add('active');

                setTimeout(() => { isChangingGif = false; }, 200);
            };

            gifImage.onerror = () => {
                currentGifIndex = (currentGifIndex + 1) % reactionGifs.length;
                isChangingGif = false;

                if (attemptsLeft > 1) {
                    showRandomGif(attemptsLeft - 1);
                } else {
                    avatarSpinner.classList.remove('visible');
                    avatarImage.classList.remove('hidden');
                }
            };

            gifImage.src = gifUrl;
        }

        let currentBackgroundIndex = 0;
        let backgroundTimer;
        let isChanging = false;
        let activeLayer = 1;
        const backgroundLayerOne = document.getElementById('bg-layer-1');
        const backgroundLayerTwo = document.getElementById('bg-layer-2');
        const glitchOverlay = document.getElementById('glitch-overlay');

        function setActiveButton(index) {
            document.querySelectorAll('.bg-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
        }

        function changeBackground(index) {
            if (isChanging) return;
            isChanging = true;
            currentBackgroundIndex = index;

            glitchOverlay.classList.remove('active');
            void glitchOverlay.offsetHeight;
            glitchOverlay.classList.add('active');

            const frontLayer = activeLayer === 1 ? backgroundLayerOne : backgroundLayerTwo;
            const backLayer = activeLayer === 1 ? backgroundLayerTwo : backgroundLayerOne;
            backLayer.style.backgroundImage = `url('${backgrounds[index]}')`;
            frontLayer.style.opacity = '0';
            backLayer.style.opacity = '1';
            activeLayer = activeLayer === 1 ? 2 : 1;

            setActiveButton(index);
            document.getElementById('copyright-text').innerText = copyrightInfo[index];

            setTimeout(() => {
                isChanging = false;
                glitchOverlay.classList.remove('active');
                frontLayer.style.backgroundImage = 'none';
            }, 400);
        }

        function startBackgroundRotation() {
            clearInterval(backgroundTimer);
            if (document.hidden) return;
            backgroundTimer = setInterval(() => {
                currentBackgroundIndex = (currentBackgroundIndex + 1) % backgrounds.length;
                changeBackground(currentBackgroundIndex);
            }, 15000);
        }

        backgroundLayerOne.style.backgroundImage = `url('${backgrounds[0]}')`;
        setActiveButton(0);
        document.getElementById('copyright-text').innerText = copyrightInfo[0];
        startBackgroundRotation();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(backgroundTimer);
            } else {
                updateClock();
                startBackgroundRotation();
            }
        });

        document.querySelector('.dialogue-box').addEventListener('click', advanceDialogue);
        document.querySelector('.avatar-circle').addEventListener('click', (e) => {
            e.stopPropagation();
            showRandomGif();
        });

        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index, 10);
                changeBackground(index);
                startBackgroundRotation();
            });
        });

        const modelViewerConfigs = [
            {
                viewer: document.getElementById('mv-model'),
                loader: document.getElementById('model-loader'),
                loadedLabel: '3D model loaded',
                loadingTimer: null,
                startupSettled: false,
                cameraOrbit: '-180deg 75deg 5m',
                minCameraOrbit: 'auto auto 1m',
                maxCameraOrbit: 'auto auto 20m',
                cameraTarget: '0m 0m 0m',
                fieldOfView: '30deg'
            },
            {
                viewer: document.getElementById('mv-model-secondary'),
                loader: document.getElementById('model-loader-secondary'),
                loadedLabel: 'Secondary 3D model loaded',
                loadingTimer: null,
                startupSettled: false,
                cameraOrbit: '180deg 90deg 18m',
                minCameraOrbit: 'auto auto 1m',
                maxCameraOrbit: 'auto auto 20m',
                cameraTarget: '0m 0.9m 0m',
                fieldOfView: '15deg'
            }
        ].filter(({ viewer, loader }) => viewer && loader);

        function applyRetroModelMaterials(viewer, config) {
            const materials = viewer.model?.materials || [];

            materials.forEach((material) => {
                const pbr = material.pbrMetallicRoughness;
                pbr.setMetallicFactor(0);
                pbr.setRoughnessFactor(0.62);
                material.setSpecularFactor?.(0.38);
                material.setClearcoatFactor?.(0);
                material.setTransmissionFactor?.(0);
            });

            if (config?.minCameraOrbit) viewer.minCameraOrbit = config.minCameraOrbit;
            if (config?.maxCameraOrbit) viewer.maxCameraOrbit = config.maxCameraOrbit;
            if (config?.cameraOrbit) viewer.cameraOrbit = config.cameraOrbit;
            if (config?.cameraTarget) viewer.cameraTarget = config.cameraTarget;
            if (config?.fieldOfView) viewer.fieldOfView = config.fieldOfView;
            viewer.jumpCameraToGoal();
            viewer.classList.add('render-ready');
        }

        function finishModelLoading(config) {
            clearTimeout(config.loadingTimer);
            config.loader.classList.add('hidden');
            config.loader.setAttribute('aria-label', config.loadedLabel);
        }

        function settleModelForStartup(config) {
            if (config.startupSettled) return;
            config.startupSettled = true;
            if (modelViewerConfigs.every((item) => item.startupSettled)) {
                markStartupReady('models');
            }
        }

        function playModelAnimations(viewer) {
            if (viewer.availableAnimations && viewer.availableAnimations.length > 0) {
                viewer.play({ repetitions: Infinity });
            }
        }

        modelViewerConfigs.forEach((config) => {
            config.viewer.addEventListener('load', () => {
                applyRetroModelMaterials(config.viewer, config);
                playModelAnimations(config.viewer);
                finishModelLoading(config);
                settleModelForStartup(config);
            });
            config.viewer.addEventListener('error', () => {
                finishModelLoading(config);
                settleModelForStartup(config);
            });
            config.viewer.addEventListener('progress', (event) => {
                if (event.detail?.totalProgress >= 1) finishModelLoading(config);
            });
        });

        let modelViewerStarted = false;
        async function startModelViewer() {
            if (modelViewerStarted) return;
            modelViewerStarted = true;
            modelViewerConfigs.forEach((config) => {
                config.loadingTimer = setTimeout(() => {
                    finishModelLoading(config);
                    settleModelForStartup(config);
                }, 12000);
            });
            try {
                await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer-module.min.js');
                await customElements.whenDefined('model-viewer');

                try {
                    await import('https://cdn.jsdelivr.net/npm/@google/model-viewer-effects@1.5.0/dist/model-viewer-effects.min.js');
                    await customElements.whenDefined('effect-composer');
                } catch (error) {
                    console.warn('Retro model post-processing could not be loaded.', error);
                }

                modelViewerConfigs.forEach((config) => {
                    config.viewer.src = config.viewer.dataset.src;
                    if (config.viewer.loaded) {
                        finishModelLoading(config);
                        settleModelForStartup(config);
                    }
                });
            } catch (error) {
                modelViewerConfigs.forEach((config) => {
                    finishModelLoading(config);
                    settleModelForStartup(config);
                });
                console.warn('3D model viewer could not be loaded.', error);
            }
        }
        startModelViewer();
        window.addEventListener('resize', startModelViewer, { passive: true });

        let parallaxFramePending = false;
        let parallaxActiveUntil = 0;

        function requestParallaxUpdate() {
            parallaxActiveUntil = performance.now() + 120;
            if (parallaxFramePending) return;
            parallaxFramePending = true;

            function renderParallaxFrame(timestamp) {
                updateParallax();
                if (timestamp < parallaxActiveUntil) {
                    requestAnimationFrame(renderParallaxFrame);
                } else {
                    parallaxFramePending = false;
                }
            }

            requestAnimationFrame(renderParallaxFrame);
        }

        function updateParallax() {
            const x = window.innerWidth / 2 - mouseX;
            const y = window.innerHeight / 2 - mouseY;

            parallaxItems.forEach(item => {
                let transX = x * item.speed;
                let transY = y * item.speed;

                if (item.constrain) {
                    const maxOffset = 15;
                    transX = Math.max(-maxOffset, Math.min(maxOffset, transX));
                    transY = Math.max(-maxOffset, Math.min(maxOffset, transY));
                }
                item.el.style.transform = `translate3d(${transX}px, ${transY}px, 0)`;
            });
        }
        requestParallaxUpdate();

        function updateClock() {
            const now = new Date();
            document.getElementById('clock').innerText =
                now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            document.getElementById('date-display').innerText =
                months[now.getMonth()] + " " + now.getDate() + " / " + days[now.getDay()];
        }
        setInterval(updateClock, 1000);
        updateClock();

        const pageTitleText = "BU SITE NIYE VAR?";
        let titleIndex = 0;
        let isDeleting = false;

        function animateTitle() {
            const currentText = pageTitleText.substring(0, titleIndex);
            document.title = currentText || "‎...";

            if (!isDeleting && titleIndex < pageTitleText.length) {
                titleIndex++;
                setTimeout(animateTitle, 200);
            } else if (isDeleting && titleIndex > 0) {
                titleIndex--;
                setTimeout(animateTitle, 100);
            } else {
                isDeleting = !isDeleting;
                setTimeout(animateTitle, isDeleting ? 2000 : 500);
            }
        }
        animateTitle();

        const pets = [];
        let petInteractionCooldown = 0;

        class Pet {
            constructor(id, config) {
                this.id = id;
                this.el = document.getElementById(id);

                if (!this.el) {
                    console.error(`Pet element with ID ${id} not found!`);
                    return;
                }

                this.container = this.el.querySelector('.pet-sprite-container');
                this.imgR = this.el.querySelector('.pet-img-right');
                this.imgL = this.el.querySelector('.pet-img-left');
                this.reactionCooldownUntil = 0;
                this.pressStartX = 0;
                this.pressStartY = 0;
                this.width = this.el.offsetWidth;
                this.height = this.el.offsetHeight;

                this.config = {
                    color: config.color || '#ff66aa',
                    startX: config.startX || window.innerWidth / 2 - 32,
                    startY: config.startY || 250,
                    isBlue: config.isBlue || false,
                    isChild: config.isChild || false
                };

                this.child = config.child || null;
                this.parents = config.parents || [];

                this.shadowEl = document.createElement('div');
                this.shadowEl.className = 'pet-shadow';
                document.body.appendChild(this.shadowEl);

                this.state = {
                    x: this.config.startX,
                    y: this.config.startY,
                    vx: 0,
                    vy: 0,
                    grounded: false,
                    facingRight: true,
                    decisionTimer: 0,
                    isGrabbed: false,
                    panicTimer: 0,
                    wasThrown: false,
                    isKissing: false,
                    kissTimer: 0,
                    kissHeartTimer: 0,
                    excited: false,
                    excitedTimer: 0,
                    trickTimer: 0,
                    impactCooldown: 0
                };

                this.visualState = {
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    targetRotation: 0,
                    impactSquash: 0,
                    impactAxis: 'x'
                };

                this.initEvents();
            }

            syncSize() {
                this.width = this.el.offsetWidth;
                this.height = this.el.offsetHeight;
            }

            initEvents() {
                this.el.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    if (e.detail > 1) return;

                    customCursor.classList.add('clicking');
                    this.pressStartX = e.clientX;
                    this.pressStartY = e.clientY;

                    if (this.state.isKissing) {
                        this.endKiss();
                        if (this.partner) this.partner.endKiss();
                    }

                    this.state.isGrabbed = true;
                    this.state.grounded = false;
                    this.state.wasThrown = false;
                    this.state.panicTimer = 0;
                    this.el.classList.add('grabbing');
                    this.state.vx = 0;
                    this.state.vy = 0;
                    e.preventDefault();
                    e.stopPropagation();
                });

                this.el.addEventListener('dblclick', (e) => {
                    if (this.state.isKissing) return;

                    this.state.isGrabbed = false;
                    this.el.classList.remove('grabbing');

                    if (this.state.grounded || this.state.y < 5) {
                        this.state.y = 0;
                        this.state.grounded = false;
                        this.state.vy = 4.5;
                        this.state.vx = (Math.random() - 0.5) * 4;
                    }

                    const rect = this.el.getBoundingClientRect();
                    this.spawnHearts(rect.left + this.width / 2, rect.top);
                    e.preventDefault();
                });

                this.el.addEventListener('mouseenter', () => {
                    if (this.state.isGrabbed || this.state.isKissing) return;
                    const now = performance.now();
                    if (now < this.reactionCooldownUntil) return;
                    this.reactionCooldownUntil = now + 450;
                    playSound();
                    this.state.excited = true;
                    this.state.excitedTimer = Math.max(this.state.excitedTimer, 22);
                    if (Math.random() < 0.45) {
                        const rect = this.el.getBoundingClientRect();
                        this.spawnHearts(rect.left + this.width / 2, rect.top + 6);
                    }
                });

                this.el.addEventListener('click', (e) => {
                    const moved = Math.hypot(e.clientX - this.pressStartX, e.clientY - this.pressStartY);
                    if (moved > 10 || e.detail !== 1) return;
                    this.state.vy = this.config.isChild ? 3.5 : 4;
                    this.state.vx += (Math.random() - 0.5) * 2;
                    this.state.grounded = false;
                    this.state.excited = true;
                    this.state.excitedTimer = 28;
                    this.visualState.impactSquash = 0.35;
                    const rect = this.el.getBoundingClientRect();
                    this.spawnHearts(rect.left + this.width / 2, rect.top + 5);
                });

                this.el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.state.isGrabbed || this.state.isKissing) return;
                    this.state.vx = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
                    this.state.vy = this.config.isChild ? 8 : 10;
                    this.state.grounded = false;
                    this.state.wasThrown = true;
                    this.state.trickTimer = 45;
                    this.state.excited = true;
                    this.state.excitedTimer = 55;
                });
            }

            spawnHearts(x, y) {
                const heart = document.createElement('div');
                heart.classList.add('heart-particle');
                if (this.config.isChild) {
                    heart.classList.add('green');
                } else if (this.config.isBlue) {
                    heart.classList.add('blue');
                } else {
                    heart.classList.add('pink');
                }

                const offsetX = (Math.random() - 0.5) * 40;
                heart.style.left = (x + offsetX) + 'px';
                heart.style.top = y + 'px';
                document.body.appendChild(heart);
                setTimeout(() => heart.remove(), 1000);
            }

            spawnKissHeart() {
                const rect = this.el.getBoundingClientRect();
                const heart = document.createElement('div');
                heart.classList.add('heart-particle', 'kiss-heart');

                if (this.config.isChild) {
                    heart.classList.add('green');
                } else if (Math.random() > 0.5) {
                    heart.classList.add('pink');
                } else {
                    heart.classList.add('blue');
                }

                const offsetX = (Math.random() - 0.5) * 60;
                const offsetY = Math.random() * 20;
                heart.style.left = (rect.left + this.width / 2 + offsetX) + 'px';
                heart.style.top = (rect.top + offsetY) + 'px';
                document.body.appendChild(heart);
                setTimeout(() => heart.remove(), 1200);
            }

            update() {
                if (this.state.impactCooldown > 0) this.state.impactCooldown--;
                if (this.state.trickTimer > 0) this.state.trickTimer--;

                if (this.state.excited) {
                    this.state.excitedTimer--;
                    if (this.state.excitedTimer <= 0) {
                        this.state.excited = false;
                    }
                }

                if (this.state.isKissing) {
                    this.state.kissTimer--;
                    this.state.kissHeartTimer--;

                    this.state.y += (0 - this.state.y) * 0.1;
                    if (Math.abs(this.state.y) < 0.5) this.state.y = 0;

                    this.state.vy = 0;
                    this.state.grounded = true;

                    if (this.partner) {
                        const dx = this.partner.state.x - this.state.x;
                        let isLeft = dx > 0;
                        if (Math.abs(dx) < 1) isLeft = this.id === 'screen-pet-1';

                        const idealDist = this.config.isChild ? 20 : 60;
                        let targetX;

                        if (isLeft) {
                            targetX = this.partner.state.x - idealDist;
                            this.state.facingRight = true;
                        } else {
                            targetX = this.partner.state.x + idealDist;
                            this.state.facingRight = false;
                        }

                        this.state.x += (targetX - this.state.x) * 0.1;
                    }

                    if (this.state.kissHeartTimer <= 0) {
                        this.spawnKissHeart();
                        this.state.kissHeartTimer = 8 + Math.random() * 12;
                    }

                    if (this.state.kissTimer <= 0) {
                        this.endKiss();
                    }

                    return;
                }

                if (this.state.isGrabbed) {
                    const targetX = mouseX - this.width / 2;
                    const targetY = window.innerHeight - mouseY - this.height / 2;
                    this.state.x += (targetX - this.state.x) * 0.24;
                    this.state.y += (targetY - this.state.y) * 0.24;
                    if (Math.abs(mouseVelocityX) > 1) this.state.facingRight = mouseVelocityX > 0;
                    return;
                }

                const GRAVITY = 0.2;
                const AIR_FRICTION = 0.99;
                const JUMP_FORCE = this.config.isChild ? 6.5 : 7;

                if (this.state.panicTimer > 0) {
                    this.state.panicTimer--;
                    if (this.state.grounded && this.state.decisionTimer <= 0) {
                        const jumpDir = this.state.facingRight ? 1 : -1;
                        this.state.vy = JUMP_FORCE * 0.6;
                        this.state.vx = jumpDir * (2 + Math.random() * 2);
                        this.state.grounded = false;
                        this.state.decisionTimer = 20 + Math.random() * 10;
                    }
                } else {
                    if (this.state.grounded && !this.state.isKissing && this.state.decisionTimer <= 0) {
                        const dxMouse = mouseX - (this.state.x + this.width / 2);
                        const dyMouse = window.innerHeight - mouseY - (this.state.y + this.height / 2);
                        if (Math.abs(dxMouse) < 250 && Math.abs(dyMouse) < 250 && Math.random() < 0.05) {
                            this.state.facingRight = dxMouse > 0;
                            if (Math.random() < 0.3) {
                                this.state.vy = this.config.isChild ? 4 : 5;
                                this.state.vx = Math.sign(dxMouse) * (1 + Math.random());
                                this.state.grounded = false;
                            }
                            this.state.decisionTimer = 30 + Math.random() * 30;
                            return;
                        }
                    }

                    if (this.config.isChild && this.parents.length > 0) {
                        const parent1 = this.parents[0];
                        const parent2 = this.parents[1];

                        const dx1 = this.state.x - parent1.state.x;
                        const dy1 = this.state.y - parent1.state.y;
                        const dist1Sq = dx1 * dx1 + dy1 * dy1;

                        const dx2 = this.state.x - parent2.state.x;
                        const dy2 = this.state.y - parent2.state.y;
                        const dist2Sq = dx2 * dx2 + dy2 * dy2;

                        let targetParent = parent1;
                        let distToTargetSq = dist1Sq;

                        if (dist2Sq < dist1Sq) {
                            targetParent = parent2;
                            distToTargetSq = dist2Sq;
                        }

                        const dxTarget = targetParent.state.x - this.state.x;

                        if (this.state.grounded) {
                            this.state.facingRight = dxTarget > 0;
                        } else {
                            this.state.facingRight = this.state.vx > 0.1 ? true : (this.state.vx < -0.1 ? false : this.state.facingRight);
                        }

                        this.state.decisionTimer--;

                        if (this.state.grounded && this.state.decisionTimer <= 0) {

                            if (parent1.state.isKissing && parent1.partner === parent2) {
                                if (!this.state.excited) {
                                    this.state.excited = true;
                                    this.state.excitedTimer = 60;
                                }
                                if (Math.random() < 0.2) {
                                    this.state.vy = JUMP_FORCE * 0.7;
                                    this.state.vx = (Math.random() - 0.5) * 2;
                                    this.state.grounded = false;
                                    this.spawnHearts(this.state.x + this.width / 2, window.innerHeight - this.state.y - this.height);
                                }
                                this.state.decisionTimer = 20;
                            }
                            else if (distToTargetSq > 10000) {
                                const jumpDir = Math.sign(dxTarget);
                                this.state.vy = JUMP_FORCE;
                                this.state.vx = jumpDir * (2.0 + Math.random());
                                this.state.grounded = false;
                                this.state.decisionTimer = 30 + Math.random() * 20;
                            }
                            else {
                                if (Math.random() < 0.03) {
                                    this.state.vy = JUMP_FORCE * 0.6;
                                    this.state.vx = (Math.random() - 0.5) * 1.5;
                                    this.state.grounded = false;
                                }
                                this.state.decisionTimer = 40 + Math.random() * 40;
                            }
                        }
                    }
                    else if (this.partner) {

                        if (this.child && this.child.state.isGrabbed) {
                            const dx = this.child.state.x - this.state.x;

                            if (this.state.grounded) this.state.facingRight = dx > 0;

                            this.state.decisionTimer--;

                            if (this.state.grounded && this.state.decisionTimer <= 0) {
                                this.state.vy = JUMP_FORCE;
                                this.state.vx = Math.sign(dx) * (2.5 + Math.random() * 1.5);
                                this.state.grounded = false;
                                this.state.decisionTimer = 15 + Math.random() * 10;
                            }
                        }
                        else if (this.child) {
                            const dxChild = this.child.state.x - this.state.x;
                            const dyChild = this.child.state.y - this.state.y;
                            const distChildSq = dxChild * dxChild + dyChild * dyChild;
                            const FAR_THRESHOLD_SQ = 122500;

                            if (distChildSq > FAR_THRESHOLD_SQ) {
                                if (this.state.grounded) this.state.facingRight = dxChild > 0;

                                this.state.decisionTimer--;

                                if (this.state.grounded && this.state.decisionTimer <= 0) {
                                    this.state.vy = JUMP_FORCE;
                                    this.state.vx = Math.sign(dxChild) * (2.0 + Math.random());
                                    this.state.grounded = false;
                                    this.state.decisionTimer = 25;
                                }
                            }
                            else {
                                const dx = this.partner.state.x - this.state.x;

                                if (!this.state.grounded) {
                                    this.state.facingRight = this.state.vx > 0.1 ? true : (this.state.vx < -0.1 ? false : this.state.facingRight);
                                } else {
                                    if (Math.abs(this.state.vx) > 0.5) {
                                        this.state.facingRight = this.state.vx > 0;
                                    } else {
                                        if (Math.abs(dx) < 400) {
                                            this.state.facingRight = dx > 0;
                                        }
                                    }
                                }

                                if (this.state.grounded) {
                                    this.state.vx = 0;
                                }

                                this.state.decisionTimer--;

                                if (this.state.decisionTimer <= 0 && this.state.grounded) {
                                    let shouldJump = false;
                                    let jumpDir = 0;
                                    let jumpStrength = 1.5;
                                    let dist = 1000;
                                    let dx = 0;

                                    if (this.partner && !this.partner.state.isKissing) {
                                        dx = this.partner.state.x - this.state.x;
                                        dist = Math.abs(dx);
                                    }

                                    if (dist > 300) {
                                        jumpDir = Math.sign(dx);
                                        jumpStrength = 2.5 + dist / 500;
                                        if (jumpStrength > 4) jumpStrength = 4;
                                        shouldJump = true;
                                        this.state.facingRight = jumpDir > 0;
                                        this.state.decisionTimer = 30 + Math.random() * 30;
                                    } else {
                                        const action = Math.random();

                                        if (action < 0.15) {
                                            jumpDir = 0;
                                            jumpStrength = 1.5 + Math.random() * 1.5;
                                            shouldJump = true;
                                            this.state.decisionTimer = 50 + Math.random() * 50;
                                        } else if (action < 0.3) {
                                            jumpDir = this.state.facingRight ? 1 : -1;
                                            jumpStrength = 1.5 + Math.random();
                                            shouldJump = true;
                                            this.state.decisionTimer = 60 + Math.random() * 100;
                                        } else {
                                            this.state.decisionTimer = 50 + Math.random() * 80;
                                        }
                                    }

                                    if (shouldJump) {
                                        this.state.vy = JUMP_FORCE;
                                        this.state.vx = jumpDir * jumpStrength;
                                        this.state.grounded = false;
                                    }
                                }
                            }
                        }
                    }
                }

                if (!this.state.grounded) {
                    this.state.vy -= GRAVITY;
                    this.state.vx *= AIR_FRICTION;
                }

                this.state.x += this.state.vx;
                this.state.y += this.state.vy;

                const width = this.width;
                const height = this.height;

                if (this.state.y <= 0) {
                    this.state.y = 0;

                    if (!this.state.grounded) {
                        if (this.state.wasThrown) {
                            this.state.panicTimer = 40;
                            this.state.decisionTimer = 0;
                            this.state.wasThrown = false;
                        }
                        this.visualState.impactSquash = 0.5;
                        this.visualState.impactAxis = 'y';

                        if (this.state.vy < -9) {
                            this.state.vy *= -0.3;
                            this.state.grounded = false;
                            this.visualState.impactSquash = 0.4;
                        } else {
                            this.state.grounded = true;
                            this.state.vy = 0;
                            this.state.vx *= 0.55;
                        }
                    } else {
                        this.state.grounded = true;
                        this.state.vy = 0;
                        this.state.vx *= 0.55;
                    }
                    if (Math.abs(this.state.vx) < 0.05) this.state.vx = 0;
                } else {
                    this.state.grounded = false;
                }

                if (this.state.y > window.innerHeight - height) {
                    this.state.y = window.innerHeight - height;
                    this.state.vy *= -0.5;
                    this.visualState.impactSquash = 0.4;
                    this.visualState.impactAxis = 'y';
                }

                if (this.state.x > window.innerWidth - width) {
                    this.state.x = window.innerWidth - width;
                    this.state.vx *= -0.5;
                    this.state.facingRight = false;
                    this.visualState.impactSquash = 0.3;
                    this.visualState.impactAxis = 'x';
                } else if (this.state.x < 0) {
                    this.state.x = 0;
                    this.state.vx *= -0.5;
                    this.state.facingRight = true;
                    this.visualState.impactSquash = 0.3;
                    this.visualState.impactAxis = 'x';
                }
            }

            startKiss() {
                this.state.isKissing = true;
                this.state.kissTimer = 120 + Math.random() * 60;
                this.state.kissHeartTimer = 5;
                this.state.vx = 0;
                this.state.vy = 0;
                this.el.classList.add('kissing');
            }

            endKiss() {
                this.state.isKissing = false;
                this.el.classList.remove('kissing');

                if (this.partner) {
                    const dx = this.partner.state.x - this.state.x;
                    this.state.vx = -Math.sign(dx) * (1 + Math.random());
                    this.state.vy = 2 + Math.random() * 2;
                    this.state.grounded = false;
                }
            }

            render() {
                if (this.state.facingRight) {
                    this.imgR.style.display = 'block';
                    this.imgL.style.display = 'none';
                } else {
                    this.imgR.style.display = 'none';
                    this.imgL.style.display = 'block';
                }

                let targetSX = 1;
                let targetSY = 1;
                let targetRot = 0;

                if (this.visualState.impactSquash > 0.01) {
                    this.visualState.impactSquash *= 0.85;
                    const val = this.visualState.impactSquash;

                    if (this.visualState.impactAxis === 'x') {
                        targetSX = 1 - val;
                        targetSY = 1 + val;
                    } else {
                        targetSY = 1 - val;
                        targetSX = 1 + val;
                    }
                } else {
                    this.visualState.impactSquash = 0;

                    if (this.state.isKissing) {
                        targetSY = 1 + Math.sin(Date.now() * 0.01) * 0.05;
                        targetSX = 1 + Math.cos(Date.now() * 0.01) * 0.03;
                        targetRot = Math.sin(Date.now() * 0.008) * 3;
                    } else if (this.state.excited) {
                        const t = Date.now() * 0.02;
                        targetSY = 1 + Math.abs(Math.sin(t)) * 0.2;
                        targetSX = 1 - Math.abs(Math.sin(t)) * 0.1;
                        targetRot = Math.sin(t * 2) * 10;
                    } else if (this.state.isGrabbed) {
                        const speed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);
                        const stretch = Math.min(speed * 0.08, 0.4);
                        targetSY = 1 + stretch;
                        targetSX = 1 - stretch * 0.5;
                        targetRot = mouseVelocityX * 2;
                    } else if (!this.state.grounded) {
                        const speed = Math.sqrt(this.state.vx * this.state.vx + this.state.vy * this.state.vy);
                        const stretch = Math.min(speed * 0.06, 0.35);
                        targetSY = 1 + stretch;
                        targetSX = 1 - stretch * 0.5;
                        if (this.state.trickTimer > 0) {
                            targetRot = this.visualState.rotation + (this.state.facingRight ? 28 : -28);
                        } else if (this.state.wasThrown) {
                            targetRot = this.visualState.rotation + (this.state.facingRight ? 5 : -5);
                        } else {
                            targetRot = this.state.vx * 3;
                        }
                    } else {
                        const breathe = Math.sin(Date.now() * 0.003) * 0.02;
                        targetSY = 1 + breathe;
                        targetSX = 1 - breathe * 0.5;

                        if (this.state.panicTimer > 0) {
                            targetRot = Math.sin(Date.now() * 0.5) * 10;
                            targetSX = 1 + Math.abs(Math.sin(Date.now() * 0.5)) * 0.1;
                        }
                    }
                }

                const lerpSpeed = 0.2;
                const rotLerpSpeed = 0.08;

                this.visualState.scaleX += (targetSX - this.visualState.scaleX) * lerpSpeed;
                this.visualState.scaleY += (targetSY - this.visualState.scaleY) * lerpSpeed;

                this.visualState.targetRotation = targetRot;
                this.visualState.rotation += (this.visualState.targetRotation - this.visualState.rotation) * rotLerpSpeed;

                this.el.classList.toggle('excited', this.state.excited);
                this.el.classList.toggle('panic', this.state.panicTimer > 0);
                this.container.style.transform = `rotate(${this.visualState.rotation}deg) scale(${this.visualState.scaleX}, ${this.visualState.scaleY})`;

                const yOffset = this.config.isChild ? 1 : 2;
                this.el.style.transform = `translate(${this.state.x}px, ${-this.state.y + yOffset}px)`;

                const shadowScale = Math.max(0, 1 - this.state.y / 200);
                const shadowOpacity = Math.max(0, 0.4 - this.state.y / 500);
                this.shadowEl.style.transform = `translate3d(${this.state.x + this.width / 2}px, 5px, 0) scale(${shadowScale})`;
                this.shadowEl.style.opacity = shadowOpacity;
            }
        }

        window.addEventListener('mouseup', () => {
            customCursor.classList.remove('clicking');

            pets.forEach(pet => {
                if (pet.state.isGrabbed) {
                    pet.state.isGrabbed = false;
                    pet.el.classList.remove('grabbing');

                    pet.state.vx = mouseVelocityX * 1.5;
                    pet.state.vy = -mouseVelocityY * 1.5;

                    const maxV = 15;
                    pet.state.vx = Math.max(-maxV, Math.min(maxV, pet.state.vx));
                    pet.state.vy = Math.max(-maxV, Math.min(maxV, pet.state.vy));

                    if (Math.abs(pet.state.vx) > 5 || Math.abs(pet.state.vy) > 5) {
                        pet.state.wasThrown = true;
                    }
                }
            });
        });

        const leftPet = new Pet('screen-pet-1', {
            color: 'var(--pink)',
            startX: window.innerWidth * 0.3,
            startY: 250,
            isBlue: false
        });

        const rightPet = new Pet('screen-pet-2', {
            color: 'var(--blue)',
            startX: window.innerWidth * 0.6,
            startY: 300,
            isBlue: true
        });

        const childPet = new Pet('screen-pet-3', {
            color: 'var(--green)',
            startX: window.innerWidth * 0.45,
            startY: 200,
            isChild: true,
            parents: [leftPet, rightPet]
        });

        leftPet.partner = rightPet;
        rightPet.partner = leftPet;

        leftPet.child = childPet;
        rightPet.child = childPet;

        pets.push(leftPet, rightPet, childPet);
        pets.forEach(pet => pet.syncSize());

        window.addEventListener('resize', () => {
            pets.forEach(pet => pet.syncSize());
        });

        function checkCollisions() {
            if (petInteractionCooldown > 0) petInteractionCooldown--;

            const firstParent = pets[0];
            const secondParent = pets[1];
            const child = pets[2];

            if (!firstParent.state.isKissing && !secondParent.state.isKissing) {
                const dx = secondParent.state.x - firstParent.state.x;
                const dy = secondParent.state.y - firstParent.state.y;
                const distSq = dx * dx + dy * dy;
                const minDist = 50;
                const minDistSq = minDist * minDist;

                if (distSq < minDistSq && distSq > 0) {
                    if (!firstParent.state.isGrabbed && !secondParent.state.isGrabbed) {

                        const childGrabbed = child.state.isGrabbed;

                        const dxc1 = child.state.x - firstParent.state.x;
                        const dyc1 = child.state.y - firstParent.state.y;
                        const distC1Sq = dxc1 * dxc1 + dyc1 * dyc1;

                        const dxc2 = child.state.x - secondParent.state.x;
                        const dyc2 = child.state.y - secondParent.state.y;
                        const distC2Sq = dxc2 * dxc2 + dyc2 * dyc2;

                        const FAR_SQ = 122500;
                        const isChildFar = (distC1Sq > FAR_SQ || distC2Sq > FAR_SQ);

                        const interactionChance = 0.08;

                        if (!childGrabbed && !isChildFar && petInteractionCooldown <= 0 && Math.random() < interactionChance) {
                            firstParent.startKiss();
                            secondParent.startKiss();
                            petInteractionCooldown = 3000;
                        } else {
                            const distance = Math.sqrt(distSq);
                            const overlap = minDist - distance;
                            const nx = dx / distance;
                            const ny = dy / distance;

                            let separateX = (overlap / 2) * nx;
                            let separateY = (overlap / 2) * ny;

                            if (firstParent.state.grounded && secondParent.state.grounded) {
                                separateY = 0;
                                separateX = (overlap / 2) * Math.sign(nx);
                            }

                            firstParent.state.x -= separateX;
                            firstParent.state.y -= separateY;
                            secondParent.state.x += separateX;
                            secondParent.state.y += separateY;

                            const dvx = firstParent.state.vx - secondParent.state.vx;
                            const dvy = firstParent.state.vy - secondParent.state.vy;
                            const dvn = dvx * nx + dvy * ny;

                            if (dvn < 0) {
                                const restitution = 0.7;
                                firstParent.state.vx -= restitution * dvn * nx;
                                firstParent.state.vy -= restitution * dvn * ny;
                                secondParent.state.vx += restitution * dvn * nx;
                                secondParent.state.vy += restitution * dvn * ny;

                                firstParent.visualState.impactSquash = 0.3;
                                secondParent.visualState.impactSquash = 0.3;
                            }
                        }
                    }
                }
            }
        }

        function checkImpactReactions() {
            for (let i = 0; i < pets.length; i++) {
                for (let j = i + 1; j < pets.length; j++) {
                    const firstPet = pets[i];
                    const secondPet = pets[j];
                    if (firstPet.state.impactCooldown > 0 || secondPet.state.impactCooldown > 0) continue;

                    const ax = firstPet.state.x + firstPet.width / 2;
                    const ay = firstPet.state.y + firstPet.height / 2;
                    const bx = secondPet.state.x + secondPet.width / 2;
                    const by = secondPet.state.y + secondPet.height / 2;
                    const dx = bx - ax;
                    const dy = by - ay;
                    const hitDistance = (firstPet.width + secondPet.width) * 0.38;
                    const relativeVx = firstPet.state.vx - secondPet.state.vx;
                    const relativeVy = firstPet.state.vy - secondPet.state.vy;
                    const impactSpeedSq = relativeVx * relativeVx + relativeVy * relativeVy;

                    if (dx * dx + dy * dy < hitDistance * hitDistance && impactSpeedSq > 18) {
                        firstPet.state.impactCooldown = 35;
                        secondPet.state.impactCooldown = 35;
                        firstPet.state.excited = true;
                        secondPet.state.excited = true;
                        firstPet.state.excitedTimer = 24;
                        secondPet.state.excitedTimer = 24;
                        firstPet.visualState.impactSquash = 0.4;
                        secondPet.visualState.impactSquash = 0.4;

                        const screenX = (ax + bx) / 2;
                        const screenY = window.innerHeight - (ay + by) / 2;
                        firstPet.spawnHearts(screenX, screenY);
                        secondPet.spawnHearts(screenX + 8, screenY - 4);
                    }
                }
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '5') {
                const backgroundIndex = parseInt(e.key, 10) - 1;
                changeBackground(backgroundIndex);
                startBackgroundRotation();
            }
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                advanceDialogue();
            }
        });

        function animate() {
            pets.forEach(pet => pet.update());
            checkCollisions();
            checkImpactReactions();
            pets.forEach(pet => pet.render());
            requestAnimationFrame(animate);
        }
        animate();

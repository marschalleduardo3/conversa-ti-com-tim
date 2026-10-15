document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayChat();
});

async function loadAndDisplayChat() {
    try {
        const response = await fetch('./_chat.txt');
        if (!response.ok) {
            throw new Error(`Erro ao carregar o arquivo: ${response.statusText}`);
        }
        const text = await response.text();
        const messages = parseChat(text);
        renderMessages(messages);
    } catch (error) {
        console.error('Não foi possível carregar o chat:', error);
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = `<div class="system-message">Erro ao carregar o chat. Verifique se o arquivo '_chat.txt' está na pasta correta e se você está usando um servidor local.</div>`;
    }
}

// Formato gerado pela exportação do WhatsApp:
// DD/MM/AAAA HH:MM - Nome: mensagem
// Mensagens do sistema não possuem "Nome:".
const whatsappLineRegex = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}) - (.*)$/;

function parseChat(chatText) {
    const lines = chatText.split(/\r?\n/);  // Suporta diferentes tipos de quebras de linha
    const messages = [];
    let currentMessage = null;

    for (const line of lines) {
        const match = line.match(whatsappLineRegex);

        if (match) {
            if (currentMessage) {
                messages.push(currentMessage);
            }

            const messageText = match[3];
            const authorSeparator = messageText.indexOf(': ');
            const hasAuthor = authorSeparator > 0;

            currentMessage = {
                timestamp: `${match[1]}, ${match[2]}`,
                author: hasAuthor ? messageText.slice(0, authorSeparator) : '',
                content: [hasAuthor ? messageText.slice(authorSeparator + 2) : messageText]
            };
        } else if (currentMessage) {
            // Linhas seguintes pertencem à mesma mensagem, inclusive linhas vazias.
            currentMessage.content.push(line);
        }
    }

    if (currentMessage) {
        messages.push(currentMessage);
    }

    messages.forEach(msg => {
        msg.content = msg.content.join('\n').replace(/\u200E/g, '').trim();
    });

    return messages;
}

function renderMessages(messages) {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = ''; // Limpa o container

    console.log("Mensagens a serem renderizadas:", messages);  // Adiciona log para conferir

    messages.forEach(msg => {
        // Verifica se a mensagem tem conteúdo
        if (!msg.content || !msg.content.trim()) {
            return;  // Se não houver conteúdo, não renderiza
        }

        const messageEl = document.createElement('div');
        if (!msg.author) {
            messageEl.classList.add('system-message');
            messageEl.textContent = `${msg.timestamp} - ${msg.content}`;
            chatContainer.appendChild(messageEl);
            return;
        }

        const messageType = msg.author === 'TI | ADVINTEGRA' ? 'sent' : 'received';
        messageEl.classList.add('message', messageType);

        // Autor (para mensagens recebidas)
        if (messageType === 'received') {
            const authorEl = document.createElement('div');
            authorEl.classList.add('author');
            authorEl.textContent = msg.author;
            messageEl.appendChild(authorEl);
        }

        const contentEl = document.createElement('div');
        contentEl.classList.add('content');

        // Lida com diferentes tipos de conteúdo
        handleContent(contentEl, msg.content);

        messageEl.appendChild(contentEl);

        // Timestamp
        const timestampEl = document.createElement('div');
        timestampEl.classList.add('timestamp');
        timestampEl.textContent = msg.timestamp;
        messageEl.appendChild(timestampEl);

        chatContainer.appendChild(messageEl);
    });

    // Rola para a última mensagem
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Inicializa os players de áudio customizados
    setupCustomAudioPlayers();
}

function handleContent(element, content) {
    // Remove o caractere invisível ‎ (U+200E)
    const cleanContent = content.replace(/\u200E/g, '').trim();  // Limpeza extra

    // Verificar se o conteúdo é vazio após a limpeza
    if (!cleanContent) {
        return; // Não renderiza nada se o conteúdo for vazio
    }

    // Regex para anexos
    // Alguns anexos ocupam uma segunda linha repetindo o nome do arquivo.
    const attachmentMatch = cleanContent.match(/^(.+?)\s*\(arquivo anexado\)/i);
    const omittedMatch = cleanContent.match(/(áudio ocultado|imagem ocultada|vídeo omitido|documento omitido)/);
    const deletedMatch = cleanContent.match(/Mensagem apagada/);
    const locationMatch = cleanContent.match(/Localização: (https?:\/\/[^\s]+)/);

    // Tratar anexos
    if (attachmentMatch) {
        const fileName = attachmentMatch[1].trim();
        const mediaPath = `${fileName}`;
        element.classList.add('media-message');

        if (/\.opus$/i.test(fileName)) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = mediaPath;
            element.appendChild(audio);
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.webp')) {
            const image = document.createElement('img');
            image.src = mediaPath;
            image.alt = 'Imagem anexada';
            image.addEventListener('click', () => window.open(mediaPath, '_blank', 'noopener'));
            element.appendChild(image);
        } else if (/\.(pdf|docx|xlsx|xls|csv)$/i.test(fileName)) {
            const link = document.createElement('a');
            link.href = mediaPath;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = `📎 ${fileName}`;
            element.appendChild(link);
        } else if (/\.mp4$/i.test(fileName)) {
            const video = document.createElement('video');
            video.controls = true;
            video.src = mediaPath;
            element.appendChild(video);
        } else {
            element.textContent = `📎 ${fileName}`;
        }
    } else if (omittedMatch || deletedMatch) {
        element.classList.add('media-message');
        const emphasis = document.createElement('em');
        emphasis.textContent = cleanContent;
        element.appendChild(emphasis);
    } else if (locationMatch) {
        const url = locationMatch[1];
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '📍 Localização compartilhada';
        element.appendChild(link);
    } else {
        // Texto normal: cria nós de texto e links sem interpretar HTML da mensagem.
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let lastIndex = 0;
        for (const match of cleanContent.matchAll(urlRegex)) {
            appendTextWithLineBreaks(element, cleanContent.slice(lastIndex, match.index));
            const link = document.createElement('a');
            link.href = match[0];
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = match[0];
            element.appendChild(link);
            lastIndex = match.index + match[0].length;
        }
        appendTextWithLineBreaks(element, cleanContent.slice(lastIndex));
    }
}

function appendTextWithLineBreaks(element, text) {
    text.split('\n').forEach((line, index) => {
        if (index > 0) {
            element.appendChild(document.createElement('br'));
        }
        element.appendChild(document.createTextNode(line));
    });
}

function setupCustomAudioPlayers() {
    document.querySelectorAll('audio[controls]').forEach(audioEl => {
        if (audioEl.nextElementSibling && audioEl.nextElementSibling.classList.contains('custom-audio-player')) {
            return; // Player já foi inicializado
        }

        const playerContainer = document.createElement('div');
        playerContainer.className = 'custom-audio-player';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'play-pause-btn';
        playPauseBtn.innerHTML = `
            <svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <svg class="pause-icon" style="display:none;" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        `;

        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        progressBarContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-bar-played"></div>
                <div class="progress-bar-handle"></div>
            </div>
        `;

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'time-display';
        timeDisplay.textContent = '0:00';

        // Monta o player
        playerContainer.appendChild(playPauseBtn);
        playerContainer.appendChild(progressBarContainer);
        playerContainer.appendChild(timeDisplay);

        // Esconde o player original e insere o customizado
        audioEl.style.display = 'none';
        audioEl.after(playerContainer);

        // Referências aos elementos internos
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');
        const progressBar = progressBarContainer.querySelector('.progress-bar');
        const progressBarPlayed = progressBarContainer.querySelector('.progress-bar-played');
        const progressBarHandle = progressBarContainer.querySelector('.progress-bar-handle');

        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };

        audioEl.addEventListener('loadedmetadata', () => {
            timeDisplay.textContent = formatTime(audioEl.duration);
        });

        audioEl.addEventListener('timeupdate', () => {
            const progress = (audioEl.currentTime / audioEl.duration) * 100;
            progressBarPlayed.style.width = `${progress}%`;
            progressBarHandle.style.left = `${progress}%`;
            timeDisplay.textContent = formatTime(audioEl.currentTime);
        });

        audioEl.addEventListener('play', () => {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        });

        audioEl.addEventListener('pause', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });

        audioEl.addEventListener('ended', () => {
            timeDisplay.textContent = formatTime(audioEl.duration);
        });

        playPauseBtn.addEventListener('click', () => {
            if (audioEl.paused) {
                audioEl.play();
            } else {
                audioEl.pause();
            }
        });

        // Lógica para arrastar a barra de progresso
        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            updateSeek(e);
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
            }
        };

        const updateSeek = (e) => {
            if (!isDragging) return;
            const progressBarRect = progressBar.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let newTime = (clientX - progressBarRect.left) / progressBarRect.width * audioEl.duration;
            newTime = Math.max(0, Math.min(newTime, audioEl.duration));
            audioEl.currentTime = newTime;
        };

        progressBar.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', updateSeek);
        document.addEventListener('mouseup', stopDrag);

        progressBar.addEventListener('touchstart', startDrag);
        document.addEventListener('touchmove', updateSeek);
        document.addEventListener('touchend', stopDrag);
    });
}

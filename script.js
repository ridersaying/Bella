document.addEventListener('DOMContentLoaded', function () {

    // --- 加载屏幕处理 ---
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        // 在动画结束后将其隐藏，以防它阻碍交互
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500); // 这个时间应该匹配 CSS 中的 transition 时间
    }, 1500); // 1.5秒后开始淡出

    // 获取需要的 DOM 元素
    let video1 = document.getElementById('video1');
    let video2 = document.getElementById('video2');
    const micButton = document.getElementById('mic-button');
    const favorabilityBar = document.getElementById('favorability-bar');

    let activeVideo = video1;
    let inactiveVideo = video2;

    // 视频列表
    const videoList = [
        '视频资源/3D 建模图片制作.mp4',
        '视频资源/jimeng-2025-07-16-1043-笑着优雅的左右摇晃，过一会儿手扶着下巴，保持微笑.mp4',
        '视频资源/jimeng-2025-07-16-4437-比耶，然后微笑着优雅的左右摇晃.mp4',
        '视频资源/生成加油视频.mp4',
        '视频资源/生成跳舞视频.mp4',
        '视频资源/负面/jimeng-2025-07-16-9418-双手叉腰，嘴巴一直在嘟囔，表情微微生气.mp4'
    ];

    // --- 视频交叉淡入淡出播放功能 ---
    function switchVideo() {
        // 1. 选择下一个视频
        const currentVideoSrc = activeVideo.querySelector('source').getAttribute('src');
        let nextVideoSrc = currentVideoSrc;
        while (nextVideoSrc === currentVideoSrc) {
            const randomIndex = Math.floor(Math.random() * videoList.length);
            nextVideoSrc = videoList[randomIndex];
        }

        // 2. 设置不活动的 video 元素的 source
        inactiveVideo.querySelector('source').setAttribute('src', nextVideoSrc);
        inactiveVideo.load();

        // 3. 当不活动的视频可以播放时，执行切换
        inactiveVideo.addEventListener('canplaythrough', function onCanPlayThrough() {
            // 确保事件只触发一次
            inactiveVideo.removeEventListener('canplaythrough', onCanPlayThrough);

            // 4. 播放新视频
            inactiveVideo.play().catch(error => {
                console.error("Video play failed:", error);
            });

            // 5. 切换 active class 来触发 CSS 过渡
            activeVideo.classList.remove('active');
            inactiveVideo.classList.add('active');

            // 6. 更新角色
            [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];

            // 为新的 activeVideo 绑定 ended 事件
            activeVideo.addEventListener('ended', switchVideo, { once: true });
        }, { once: true }); // 使用 { once: true } 确保事件只被处理一次
    }

    // 初始启动
    activeVideo.addEventListener('ended', switchVideo, { once: true });


    // --- 语音识别核心 ---
    // const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    // let recognition;

    // // 检查浏览器是否支持语音识别
    // if (SpeechRecognition) {
    //     recognition = new SpeechRecognition();
    //     recognition.continuous = true; // 持续识别
    //     recognition.lang = 'zh-CN'; // 设置语言为中文
    //     recognition.interimResults = true; // 获取临时结果

    //     recognition.onresult = (event) => {
    //         const transcriptContainer = document.getElementById('transcript');
    //         let final_transcript = '';
    //         let interim_transcript = '';

    //         for (let i = event.resultIndex; i < event.results.length; ++i) {
    //             if (event.results[i].isFinal) {
    //                 final_transcript += event.results[i][0].transcript;
    //             } else {
    //                 interim_transcript += event.results[i][0].transcript;
    //             }
    //         }

    //         // 显示最终识别结果
    //         transcriptContainer.textContent = final_transcript || interim_transcript;

    //         // 基于关键词的情感分析和视频切换
    //         if (final_transcript) {
    //             analyzeAndReact(final_transcript);
    //         }
    //     };

    //     recognition.onerror = (event) => {
    //         console.error('语音识别错误:', event.error);
    //     };

    // } else {
    //     console.log('您的浏览器不支持语音识别功能。');
    //     // 可以在界面上给用户提示
    // }

    // // --- 麦克风按钮交互 ---
    // let isListening = false;

    // micButton.addEventListener('click', function() {
    //     if (!SpeechRecognition) return; // 如果不支持，则不执行任何操作

    //     isListening = !isListening;
    //     micButton.classList.toggle('is-listening', isListening);
    //     const transcriptContainer = document.querySelector('.transcript-container');
    //     const transcriptText = document.getElementById('transcript');

    //     if (isListening) {
    //         transcriptText.textContent = '聆听中...'; // 立刻显示提示
    //         transcriptContainer.classList.add('visible');
    //         recognition.start();
    //     } else {
    //         recognition.stop();
    //         transcriptContainer.classList.remove('visible');
    //         transcriptText.textContent = ''; // 清空文本
    //     }
    // });

    // --- SiliconFlow 语音识别核心 ---
    const SILICONFLOW_TOKEN = "你的SiliconFlow Token"; // 替换为你的Token

    let mediaRecorder = null;
    let audioChunks = [];
    let isListening = false;
    let intervalId = null;

    micButton.addEventListener('click', async function () {
        const transcriptContainer = document.querySelector('.transcript-container');
        const transcriptText = document.getElementById('transcript');

        isListening = !isListening;
        micButton.classList.toggle('is-listening', isListening);

        if (isListening) {
            transcriptText.textContent = '聆听中...';
            transcriptContainer.classList.add('visible');
            audioChunks = [];

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                if (audioChunks.length === 0) return;
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                audioChunks = [];
                await sendToSiliconflow(audioBlob, transcriptText, transcriptContainer);
                // 如果还在录音，继续录
                if (isListening) {
                    mediaRecorder.start();
                }
            };

            mediaRecorder.start();

            // 每5秒分段识别
            intervalId = setInterval(() => {
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
            }, 5000);

        } else {
            transcriptContainer.classList.remove('visible');
            transcriptText.textContent = '';
            clearInterval(intervalId);
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
        }
    });

    async function sendToSiliconflow(audioBlob, transcriptText, transcriptContainer) {
        const form = new FormData();
        form.append("model", "FunAudioLLM/SenseVoiceSmall");
        form.append("audio", audioBlob, "audio.webm");

        try {
            const response = await fetch("https://api.siliconflow.cn/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SILICONFLOW_TOKEN}`,
                },
                body: form,
            });
            const data = await response.json();
            transcriptText.textContent += (data.text || "") + "\n";
            transcriptContainer.classList.add('visible');
            if (data.text) {
                analyzeAndReact(data.text);
            }
        } catch (err) {
            transcriptText.textContent += "[识别出错]\n";
        }
    }


    // --- 情感分析与反应 ---
    const positiveWords = ['开心', '高兴', '喜欢', '太棒了', '你好', '漂亮'];
    const negativeWords = ['难过', '生气', '讨厌', '伤心'];

    const positiveVideos = [
        '视频资源/jimeng-2025-07-16-1043-笑着优雅的左右摇晃，过一会儿手扶着下巴，保持微笑.mp4',
        '视频资源/jimeng-2025-07-16-4437-比耶，然后微笑着优雅的左右摇晃.mp4',
        '视频资源/生成加油视频.mp4',
        '视频资源/生成跳舞视频.mp4'
    ];
    const negativeVideo = '视频资源/负面/jimeng-2025-07-16-9418-双手叉腰，嘴巴一直在嘟囔，表情微微生气.mp4';

    function analyzeAndReact(text) {
        let reaction = 'neutral'; // 默认为中性

        if (positiveWords.some(word => text.includes(word))) {
            reaction = 'positive';
        } else if (negativeWords.some(word => text.includes(word))) {
            reaction = 'negative';
        }

        if (reaction !== 'neutral') {
            switchVideoByEmotion(reaction);
        }
    }

    function switchVideoByEmotion(emotion) {
        let nextVideoSrc;
        if (emotion === 'positive') {
            const randomIndex = Math.floor(Math.random() * positiveVideos.length);
            nextVideoSrc = positiveVideos[randomIndex];
        } else { // negative
            nextVideoSrc = negativeVideo;
        }

        // 避免重复播放同一个视频
        const currentVideoSrc = activeVideo.querySelector('source').getAttribute('src');
        if (nextVideoSrc === currentVideoSrc) return;

        // --- 以下逻辑与 switchVideo 函数类似，用于切换视频 ---
        inactiveVideo.querySelector('source').setAttribute('src', nextVideoSrc);
        inactiveVideo.load();

        inactiveVideo.addEventListener('canplaythrough', function onCanPlayThrough() {
            inactiveVideo.removeEventListener('canplaythrough', onCanPlayThrough);
            inactiveVideo.play().catch(error => console.error("Video play failed:", error));
            activeVideo.classList.remove('active');
            inactiveVideo.classList.add('active');
            [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];
            // 情感触发的视频播放结束后，回归随机播放
            activeVideo.addEventListener('ended', switchVideo, { once: true });
        }, { once: true });
    }

});
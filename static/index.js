function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Text copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    } else {
        alert('Clipboard API is not supported in your browser.');
    }
}

// 讓錄音按鈕添加事件監聽器
document.getElementById('startBtn').addEventListener('click', startRecording);
document.getElementById('stopBtn').addEventListener('click', stopRecording);

let mediaRecorder;
let audioChunks = [];
const userInput = document.querySelector(".user-input");

// 開始錄音功能
function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            audioChunks = [];
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                uploadAudio(audioBlob);
            });
        })
        .catch(error => console.error('錄音啟動失敗:', error));
}

// 停止錄音功能
function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

// 上傳音頻到伺服器(app.py)
function uploadAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');

    fetch('/upload-audio', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        if (data.transcript) {
            userInput.value = data.transcript;
        } else {
            userInput.value = '錯誤: ' + data.message;
        }
    })
    .catch(error => console.error('錯誤:', error));
}

// 當網頁DOM內容被加載完成後，這個函數會被觸發
document.addEventListener("DOMContentLoaded", function() {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.querySelector(".user-input");
    const chatHistory = document.querySelector(".chat-history");
    const exampleQuestionsContainer = document.querySelector(".example-questions");

    // 隱藏範例問題的容器
    exampleQuestionsContainer.style.display = "none";

    // 顯示範例問題的功能
    function displayExampleQuestions(questions) {
        exampleQuestionsContainer.innerHTML = ''; // 清空舊的範例問題
        if (questions && questions.length > 0) {
            questions.forEach(question => {
                const questionBubble = document.createElement("div");
                questionBubble.classList.add("example-question");
                questionBubble.textContent = question;
                questionBubble.addEventListener("click", function() {
                    userInput.value = question;  // 將範例問題填入輸入框
                    exampleQuestionsContainer.style.display = "none";  // 隱藏範例問題
                });
                exampleQuestionsContainer.appendChild(questionBubble);
            });
            exampleQuestionsContainer.style.display = "flex";
        } else {
            exampleQuestionsContainer.style.display = "none";
        }
    }

    // 定義表單提交功能
    function submitForm() {
        const userMessage = userInput.value.trim();
        if (userMessage === "") return;

        // 清除範例問題
        exampleQuestionsContainer.style.display = "none";

        const userMessageDiv = document.createElement("div");
        userMessageDiv.classList.add("message", "user");
        userMessageDiv.innerHTML = "<i class='fa-solid fa-user'></i><p>" + userMessage + "</p>";
        chatHistory.appendChild(userMessageDiv);

        const loader = document.createElement("div");
        loader.classList.add("loader", "message", "assistant");
        chatHistory.appendChild(loader);

        fetch("/get_response", {
            method: "POST",
            body: new URLSearchParams({ user_input: userMessage }),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
        .then(response => response.json())
        .then(data => {
            chatHistory.removeChild(loader);
            const assistantMessageDiv = document.createElement("div");
            assistantMessageDiv.classList.add("message", "assistant");
            const escapedAssistantMessage = data.response.replace(/\n/g, "<br>");
            assistantMessageDiv.innerHTML = `<i class='fa-solid fa-comment'></i><p id='res-mes'>${escapedAssistantMessage}</p>`;
            chatHistory.appendChild(assistantMessageDiv);
            assistantMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

            // 回答後重新生成新的範例問題
            //displayExampleQuestions(data.example_questions);
        });
        userInput.value = "";  // 清空輸入框
    }

    // 提交表單的監聽
    chatForm.addEventListener("submit", function(event) {
        event.preventDefault();
        submitForm();
    });
});


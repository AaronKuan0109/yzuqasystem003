function copyText(text) {
    navigator.clipboard.writeText(text);
}
document.getElementById('startBtn').addEventListener('click', startRecording);
document.getElementById('stopBtn').addEventListener('click', stopRecording);

let mediaRecorder;
let audioChunks = [];
const userInput = document.querySelector(".user-input");
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
                const audioUrl = URL.createObjectURL(audioBlob);
                uploadAudio(audioBlob);
            });
        })
        .catch(error => console.error('錄音啟動失敗:', error));
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());  // 停止所有軌道，關閉麥克風
    }
}

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
document.addEventListener("DOMContentLoaded", function() {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.querySelector(".user-input");
    const chatHistory = document.querySelector(".chat-history");
    const sendButton = document.querySelector(".send-button");
    const submitButton=document.querySelector(".submit-button");
    //const similar=document.querySelector(".similar");
    //Display chat
    chatForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const userMessage = userInput.value;
    
        if (userMessage.trim() !== "") {
            //similar.innerHTML="";
            const userMessageDiv = document.createElement("div");
            userMessageDiv.classList.add("message", "user");
            //userMessageDiv.textContent = userMessage;
            userMessageDiv.innerHTML = "<i class='fa-solid fa-user'></i><p>" + userMessage + "</p>";
            chatHistory.appendChild(userMessageDiv);
            const assistantMessageDiv = document.createElement("div");
            
            
            const loader = document.createElement("div");
            loader.classList.add("loader","message", "assistant");
            

            assistantMessageDiv.innerHTML ="<i class='fa-solid fa-comment'></i><p id='res-mes'><div class='loader message assistant'></div></p>";
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
                //response
                chatHistory.removeChild(loader);
                const assistantMessage = data.response;
                assistantMessageDiv.classList.add("message", "assistant");
                const escapedAssistantMessage = assistantMessage.replace(/\n/g, "<br>");
                //revisedAssistantMessage = escapedAssistantMessage.replace(/\**/g, "<b>");
                let timestamp = Date.now();
                let date = new Date(timestamp);
                let hours = date.getHours().toString().padStart(2, '0');
                let minutes = date.getMinutes().toString().padStart(2, '0');
                let formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}:${date.getSeconds()}`;
               
                assistantMessageDiv.innerHTML =" <i class='fa-solid fa-comment'></i><p id='res-mes'>"+escapedAssistantMessage+"<br>"+formattedDate+"</p><i class='far fa-copy' onclick='copyText(\""+escapedAssistantMessage+"\")'></i>";
                chatHistory.appendChild(assistantMessageDiv);
                // 滾動到最新的回答
                assistantMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                //top N similar questions
                /*
                const topQ=data.top_three;
                var values = Object.values(topQ);
                for(num=0; num<values.length; num++){
                    topQDiv=document.createElement("li");
                    topQDiv.textContent=`${values[num]['Q']}`;
                    similar.append(topQDiv);
                }*/

            });
            userInput.value = "";
        }
    });
});

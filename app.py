from flask import Flask, render_template, request, jsonify
import os
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.chains.question_answering import load_qa_chain
from langchain_community.callbacks import get_openai_callback
from langchain_openai import ChatOpenAI
from opencc import OpenCC

import openai
import io
import sys
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

openai.api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()

embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")

app = Flask(__name__)
vector_store = Chroma(
    collection_name="test",
    embedding_function=OpenAIEmbeddings(),
    persist_directory="./db/test"
)

class NamedBytesIO(io.BytesIO):
    name = 'transcript.wav'

chat_history = []
data_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

if not os.path.exists(data_folder):
    os.makedirs(data_folder)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_response', methods=['POST'])
def get_response():
    user_input = request.form.get('user_input')
    db = None
    if not user_input:
        return jsonify({'error': 'No user input provided'})
    if user_input:
        docs = vector_store.similarity_search(user_input)
        print(docs)
        llm = ChatOpenAI(
            model_name="gpt-4o",
            temperature=0.1,
            #max_tokens=1000   # 設置最大字數，提供更長的回答
        )
        prompt = "你是一位負責回答教務處相關問題的人員，學生會向你詢問教務處相關的問題，當學生向你詢問問題時，請先分析那些資料能更好的協助解決這個問題，像是相關人員的聯絡方式或某件事的處理流程，並提供完整的回答，所有跟問題有關的資訊都要條列式列出，並附上必要的網頁連接，不要只回答一句話。"
        chain = load_qa_chain(llm, chain_type="stuff")

        with get_openai_callback() as cb:
            response = chain.invoke({"input_documents": docs,"question":user_input}, return_only_outputs=True)
        cc = OpenCC('s2t')
        answer=cc.convert(response['output_text'])
        chat_history.append({'user': user_input, 'assistant': response['output_text']})
        return jsonify({'response': answer})

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    audio_file = request.files['audio']
    if audio_file:
        audio_stream = NamedBytesIO(audio_file.read())
        audio_stream.name = 'transcript.wav' 

        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_stream,
            response_format='text'
        )
        cc = OpenCC('s2t')
        text = cc.convert(transcript)
        return jsonify({'message': '音頻已處理', 'transcript': text})
    return jsonify({'error': '沒有接收到音訊文件'}), 400


if __name__ == '__main__':
    app.run(debug=True, port = 3308)  

from flask import Flask, render_template, request, jsonify
import os
import random
import re
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.chains.question_answering import load_qa_chain
from langchain_community.callbacks import get_openai_callback
from langchain_openai import ChatOpenAI
from opencc import OpenCC
import openai
import io
from openai import OpenAI
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 设置 OpenAI API 密钥
openai.api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()

# 初始化向量嵌入模型
embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")

# 初始化 Flask 应用
app = Flask(__name__)

# 初始化向量存储，配置向量数据库的位置和嵌入函数
vector_store = Chroma(
    collection_name="test",  # 向量集合的名称
    embedding_function=OpenAIEmbeddings(),  # 嵌入函数，用于将文本转换为向量
    persist_directory="./db/test"  # 向量数据库的存储位置
)

# 自定义 NamedBytesIO 类，用于处理音频文件上传
class NamedBytesIO(io.BytesIO):
    name = 'transcript.wav'  # 设置默认的文件名

# 聊天历史记录的存储
chat_history = []

# 定义问题模板
question_templates = {
    "證明": [
        "如何申請{keyword}？",
        "{keyword}需要哪些文件？",
        "{keyword}的用途是什麼？",
        "辦理{keyword}的流程是什麼？",
        "{keyword}需要多久可以拿到？"
    ],
    "申請": [
        "申請{keyword}的流程是什麼？",
        "{keyword}的條件有哪些？",
        "辦理{keyword}需要多長時間？",
        "{keyword}的審核標準是什麼？",
        "{keyword}的辦理費用是多少？"
    ],
   
}

# 定义回答后处理函数
def post_process_answer(answer_text):
    # 清理回答中的多余空白行
    cleaned_answer = "\n".join([line.strip() for line in answer_text.split("\n") if line.strip()])
    return cleaned_answer

# 从用户输入中提取最短有效主词
#def find_keyword_with_header(user_input):
#    for header in question_templates:
#        # 查找包含标头的最短词组（例如 "畢業證書"）
#        match = re.search(rf"(\S*{header}\S*)", user_input)
#        if match:
#            return header, match.group(0)  # 返回标头和完整主词
#    return None, None

# 根据完整主词生成範例問題
#def generate_example_questions_from_keyword(header, keyword):
#    example_questions = []
#    if header in question_templates:
#        for _ in range(3):  # 随机取3个问题
#            question_template = random.choice(question_templates[header])
#            question = question_template.format(keyword=keyword)
#           example_questions.append(question)
#    return example_questions

# 定义首页路由，渲染 index.html 模板
@app.route('/')
def index():
    return render_template('index.html')

# 定义获取回答的路由，处理 POST 请求
@app.route('/get_response', methods=['POST'])
def get_response():
    user_input = request.form.get('user_input')
    if not user_input:
        return jsonify({'error': 'No user input provided'})

    # 执行相似性搜索，查找与输入最相关的文档
    k = 8
    docs = vector_store.similarity_search(user_input, k=k)
    #threshold = 0.8  # 设定相似度阈值
    #docs = [doc for doc in vector_store.similarity_search(user_input, k=k) if doc.similarity >= threshold]

    # 在终端输出找到的参考文本内容
    print("\n參考的文本內容：")
    for i, doc in enumerate(docs):
        print(f"文檔 {i+1}: {doc.page_content}\n")

    # 将向量搜索到的文档内容和对话历史结合为上下文
    history_text = "\n".join([f"User: {entry['user']}\nAssistant: {entry['assistant']}" for entry in chat_history])
    combined_input = history_text + "\n\n" + "相關資料:\n" + "\n".join([doc.page_content for doc in docs]) + "\n\n" + f"User: {user_input}"

    # 初始化语言模型（LLM），配置生成回答的参数
    llm = ChatOpenAI(model_name="gpt-4o", temperature=0.1, max_tokens=2500)

    # 提示词，引导模型生成详细的回答
    prompt = (
        "你是一位負責回答全球事務處（Global Affairs Office）相關問題的人員。會有不同國籍的人員用不同語言向你詢問問題，請仔細從提供的資料中提取有用的信息回答問題，"
        "回答用戶的問題時，請務必提供相關的網址連接，並盡可能提供相關細節與資訊、列出具體的流程步驟和聯系人相關信息來回答用戶問題。"
        "請務必提供相關的數據或資料有提供的網址連接。"
    )

    # 加载问答链（QA chain），用于处理问答任务
    chain = load_qa_chain(llm, chain_type="stuff")

    # 使用 OpenAI 回调监控执行状态
    with get_openai_callback() as cb:
        response = chain.invoke({"input_documents": docs, "question": combined_input}, return_only_outputs=True)

    # 回答的后处理阶段，可以在这里进一步提取具体细节或进行格式调整
    answer = post_process_answer(response['output_text'])

    # 使用 OpenCC 将简体中文转换为繁体中文
    cc = OpenCC('s2t')
    answer = cc.convert(answer)

    # 将当前对话添加到对话历史中
    chat_history.append({'user': user_input, 'assistant': answer})

    # 提取主词并生成範例問題
    #header, keyword = find_keyword_with_header(user_input)
    #example_questions = generate_example_questions_from_keyword(header, keyword) if keyword else []

    # 返回生成的回答和範例問題
    return jsonify({'response': answer})

# 运行 Flask 应用，设置调试模式和端口号
if __name__ == '__main__':
    app.run(debug=True, port=3308)

from dotenv import load_dotenv

load_dotenv()

from langchain_openai import ChatOpenAI, data
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate 
from langchain_text_splitters import RecursiveCharacterTextSplitter

loader = PyPDFLoader("GRU.pdf")
docs = loader.load()

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful AI assitant that summarizes text."), 
    ("human", "{input}")
])

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)

chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.9)
prompt = prompt_template.format(input=chunks[0].page_content)

response = chat_model.invoke(prompt)
print(response.content)
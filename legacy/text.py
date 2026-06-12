from dotenv import load_dotenv

load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate

data = TextLoader("notes.txt").load()

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful AI assitant that summarizes text."), 
    ("human", "{input}")
])

chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.9)
prompt = prompt_template.format(input=data[0].page_content)

response = chat_model.invoke(prompt)
print(response.content)
from enum import Enum
from fastapi import FastAPI
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

class Category(Enum):
    TOOLS = "tools"
    CONSUMABLES = "consumables"

class Item(BaseModel):
    name: str
    price: float
    count: int
    id : int
    category: Category  

items = {
    0: Item(name = "Hammer", price=9.99, count=20, id=0, category=Category.TOOLS)
}

@app.get("/")
def index() -> dict[str, dict[int, Item]]:
    return {"items": items}

Instrumentator().instrument(app).expose(app)

# how to activate venv
# source venv/bin/activate
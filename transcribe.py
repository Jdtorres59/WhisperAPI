import openai
from openai import OpenAI
import config

client = OpenAI(api_key=config.API_KEY)
file = open("audio_files/apple.mp3", "rb")
result = client.audio.transcriptions.create(model="whisper-1", file=file)
print(result)
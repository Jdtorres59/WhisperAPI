import config
import openai
from openai import OpenAI

client = OpenAI(api_key=config.API_KEY)
whisper_file = open("audio_files/german.mp3", "rb")
result = client.audio.translations.create(model="whisper-1", file=whisper_file)
print(result)
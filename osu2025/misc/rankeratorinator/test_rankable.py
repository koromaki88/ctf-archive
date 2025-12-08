import torch
import tempfile
import base64
from transformers import AutoProcessor, AutoModelForSequenceClassification

device = "cuda" if torch.cuda.is_available() else "cpu"
save_path = r"OliBomby/CM3P-ranked-classifier"

audio = r"audio.mp3"

with tempfile.NamedTemporaryFile() as f:
    print("base64 encoded beatmap: ", flush=True)
    data = input().encode()

    print("thinking... this can take up to five minutes", flush=True)

    f.write(base64.b64decode(data))
    f.flush()

    processor = AutoProcessor.from_pretrained(save_path, trust_remote_code=True, revision="main")
    model = AutoModelForSequenceClassification.from_pretrained(save_path, torch_dtype=torch.bfloat16, device_map=device, attn_implementation="sdpa", trust_remote_code=True, revision="main")

    inputs = processor(beatmap=f.name, audio=audio)
    inputs = inputs.to(device, dtype=torch.bfloat16)

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = logits.softmax(dim=-1).cpu()

    ranked_threshold = 0.4
    predicted_ranked_states = probs[:, 1] >= ranked_threshold

    if predicted_ranked_states.all():
        print("Congratulations! Your beatmap has been approved to the ranked section. osu{test_flag}")
    else:
        print("Unfortunately, your beatmap has some quality issues and could not be approved to the ranked section. Please focus on improving these sections:")

        for i, predicted_ranked_state in enumerate(predicted_ranked_states):
            if not predicted_ranked_state:
                start_time = i * processor.default_kwargs["beatmap_kwargs"]["window_stride_sec"]
                end_time = start_time + processor.default_kwargs["beatmap_kwargs"]["window_length_sec"]
                print(f"- From {start_time:.0f}s to {end_time:.0f}s")

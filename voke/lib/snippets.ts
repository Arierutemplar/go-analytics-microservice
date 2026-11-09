import { VOKE_ENDPOINT } from "@/lib/models";
import type { HeroLanguage, PlaygroundDraft, PlaygroundLanguage } from "@/types";

function messages(draft: Pick<PlaygroundDraft, "system" | "prompt">): { role: string; content: string }[] {
  const rows: { role: string; content: string }[] = [];
  if (draft.system.trim()) rows.push({ role: "system", content: draft.system.trim() });
  rows.push({ role: "user", content: draft.prompt });
  return rows;
}

function payload(draft: PlaygroundDraft): string {
  return JSON.stringify(
    {
      model: draft.model,
      temperature: draft.temperature,
      top_p: draft.topP,
      max_tokens: draft.maxTokens,
      messages: messages(draft),
    },
    null,
    2,
  );
}

function shellSingleQuoted(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function heroSample(language: HeroLanguage, model: string): string {
  if (language === "javascript") {
    return `import Voke from "voke";

const voke = new Voke({ apiKey: process.env.VOKE_API_KEY });

const completion = await voke.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Summarize this incident." }],
});`;
  }
  if (language === "python") {
    return `from voke import Voke

client = Voke()

completion = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Summarize this incident."}],
)`;
  }
  return `curl ${VOKE_ENDPOINT} \\
  -H "Authorization: Bearer $VOKE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${model}","messages":[{"role":"user","content":"Summarize this incident."}]}'`;
}

export function playgroundSnippet(language: PlaygroundLanguage, draft: PlaygroundDraft): string {
  const body = payload(draft);
  const key = draft.apiKey || "voke_live_your_key";

  if (language === "curl") {
    return `curl ${VOKE_ENDPOINT} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d ${shellSingleQuoted(body)}`;
  }

  if (language === "node") {
    return `const response = await fetch("${VOKE_ENDPOINT}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${body}),
});

if (!response.ok) {
  throw new Error(\`Voke \${response.status}: \${await response.text()}\`);
}

const completion = await response.json();
console.log(completion.choices[0].message.content);`;
  }

  if (language === "python") {
    return `import json
import urllib.request

body = json.dumps(${body}).encode()
request = urllib.request.Request(
    "${VOKE_ENDPOINT}",
    data=body,
    headers={
        "Authorization": "Bearer ${key}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(request) as response:
    print(json.load(response)["choices"][0]["message"]["content"])`;
  }

  const escaped = body.replaceAll("`", "'");
  return `package main

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
)

func main() {
    body := []byte(\`${escaped}\`)
    req, err := http.NewRequest(http.MethodPost, "${VOKE_ENDPOINT}", bytes.NewReader(body))
    if err != nil {
        panic(err)
    }
    req.Header.Set("Authorization", "Bearer ${key}")
    req.Header.Set("Content-Type", "application/json")

    res, err := http.DefaultClient.Do(req)
    if err != nil {
        panic(err)
    }
    defer res.Body.Close()
    payload, _ := io.ReadAll(res.Body)
    fmt.Printf("%s\\n", payload)
}`;
}

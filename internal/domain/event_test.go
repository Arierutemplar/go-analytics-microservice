package domain

import (
	"encoding/json"
	"testing"
)

func TestEventPayloadAcceptsAnyJSON(t *testing.T) {
	cases := map[string]string{
		"string":  `{"id":"1","payload":"texto simple"}`,
		"objeto":  `{"id":"1","payload":{"page":"/home","meta":{"a":[1,2]}}}`,
		"array":   `[1]`,
		"ausente": `{"id":"1"}`,
		"null":    `{"id":"1","payload":null}`,
	}
	for name, body := range cases {
		var e Event
		err := json.Unmarshal([]byte(body), &e)
		if name == "array" {
			if err == nil {
				t.Errorf("%s: un array raíz no es un Event válido", name)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		// Debe poder re-serializarse (persistencia, WebSocket, historial)
		if _, err := json.Marshal(e); err != nil {
			t.Errorf("%s: marshal: %v", name, err)
		}
	}

	var e Event
	_ = json.Unmarshal([]byte(`{"payload":{"k":"v"}}`), &e)
	out, _ := json.Marshal(e)
	var back map[string]any
	_ = json.Unmarshal(out, &back)
	if back["payload"].(map[string]any)["k"] != "v" {
		t.Errorf("payload objeto no se conservó: %s", out)
	}
}

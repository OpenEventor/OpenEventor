package sse

import (
	"encoding/json"
	"sync"
)

// Message represents an SSE event to be sent to clients.
type Message struct {
	Event string // SSE event name: "passing", "competitor"
	Data  string // JSON payload
}

// MustJSON marshals v to JSON string, panics on error (use only with trusted data).
func MustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic("sse: json marshal: " + err.Error())
	}
	return string(b)
}

const clientBufSize = 256

// eventHub manages SSE clients for a single event.
type eventHub struct {
	broadcast  chan Message
	register   chan chan Message
	unregister chan chan Message
	clients    map[chan Message]struct{}
}

func newEventHub() *eventHub {
	return &eventHub{
		broadcast:  make(chan Message, clientBufSize),
		register:   make(chan chan Message),
		unregister: make(chan chan Message),
		clients:    make(map[chan Message]struct{}),
	}
}

// run is the hub's main loop. One goroutine per event.
func (h *eventHub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client)
			}

		case msg := <-h.broadcast:
			for client := range h.clients {
				select {
				case client <- msg:
				default:
					// Slow client — drop and disconnect.
					delete(h.clients, client)
					close(client)
				}
			}
		}
	}
}

// Broker manages SSE hubs across all events.
type Broker struct {
	mu   sync.Mutex
	hubs map[string]*eventHub
}

// NewBroker creates a new SSE broker.
func NewBroker() *Broker {
	return &Broker{
		hubs: make(map[string]*eventHub),
	}
}

// hub returns or lazily creates the hub for an event.
func (b *Broker) hub(eventID string) *eventHub {
	b.mu.Lock()
	defer b.mu.Unlock()

	h, ok := b.hubs[eventID]
	if !ok {
		h = newEventHub()
		b.hubs[eventID] = h
		go h.run()
	}
	return h
}

// Register adds a new client for the given event and returns its message channel.
func (b *Broker) Register(eventID string) chan Message {
	ch := make(chan Message, clientBufSize)
	b.hub(eventID).register <- ch
	return ch
}

// Unregister removes a client from the given event.
func (b *Broker) Unregister(eventID string, ch chan Message) {
	b.hub(eventID).unregister <- ch
}

// Broadcast sends a message to all clients of the given event.
func (b *Broker) Broadcast(eventID string, msg Message) {
	b.mu.Lock()
	h, ok := b.hubs[eventID]
	b.mu.Unlock()

	if ok {
		select {
		case h.broadcast <- msg:
		default:
			// Broadcast channel full — drop message.
		}
	}
}

package handlers

// ═══════════════════════════════════════════════════════════════════════════════
// Hybrid Logical Clock (HLC)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wall clocks drift and offline stations have no reliable NTP, so ordering and
// conflict resolution must never depend on raw time.Now() comparisons across
// nodes. An HLC combines a physical timestamp with a logical counter and a node
// id, giving a monotonic, causally-consistent, deterministically-tie-broken
// clock.
//
//   HLC string format:  "<physicalMillis>.<logical>.<nodeId>"
//
// Properties:
//   • Never goes backwards (monotonic) even if the wall clock jumps back.
//   • Two events on the same node always have increasing HLCs.
//   • Comparisons are total: (physical, logical, nodeId) lexicographic.
//   • On receiving a remote HLC, the local clock advances past it (causality).

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type HLC struct {
	mu       sync.Mutex
	physical int64  // milliseconds
	logical  int64
	nodeID   string
}

// NewHLC creates a clock for a node (e.g. "edge:<stationId>" or "cloud").
func NewHLC(nodeID string) *HLC {
	if nodeID == "" {
		nodeID = "cloud"
	}
	return &HLC{nodeID: nodeID}
}

// Now returns the next HLC for a local event.
func (h *HLC) Now() string {
	h.mu.Lock()
	defer h.mu.Unlock()
	wall := time.Now().UnixMilli()
	if wall > h.physical {
		h.physical = wall
		h.logical = 0
	} else {
		// wall clock didn't advance — bump the logical counter
		h.logical++
	}
	return h.format(h.physical, h.logical)
}

// Update advances the local clock past a received remote HLC, preserving
// causality, then returns a fresh local HLC.
func (h *HLC) Update(remote string) string {
	rp, rl, _ := parseHLC(remote)
	h.mu.Lock()
	defer h.mu.Unlock()
	wall := time.Now().UnixMilli()

	maxP := h.physical
	if rp > maxP {
		maxP = rp
	}
	if wall > maxP {
		maxP = wall
	}

	switch {
	case maxP == h.physical && maxP == rp:
		if rl > h.logical {
			h.logical = rl
		}
		h.logical++
	case maxP == h.physical:
		h.logical++
	case maxP == rp:
		h.logical = rl + 1
	default:
		h.logical = 0
	}
	h.physical = maxP
	return h.format(h.physical, h.logical)
}

func (h *HLC) format(p, l int64) string {
	return fmt.Sprintf("%d.%d.%s", p, l, h.nodeID)
}

func parseHLC(s string) (physical, logical int64, nodeID string) {
	parts := strings.SplitN(s, ".", 3)
	if len(parts) >= 1 {
		physical, _ = strconv.ParseInt(parts[0], 10, 64)
	}
	if len(parts) >= 2 {
		logical, _ = strconv.ParseInt(parts[1], 10, 64)
	}
	if len(parts) >= 3 {
		nodeID = parts[2]
	}
	return
}

// CompareHLC returns -1 if a<b, 0 if equal, 1 if a>b. Total order with nodeId
// as the final tie-breaker so two nodes never deadlock on "equal" timestamps.
func CompareHLC(a, b string) int {
	ap, al, an := parseHLC(a)
	bp, bl, bn := parseHLC(b)
	switch {
	case ap != bp:
		if ap < bp {
			return -1
		}
		return 1
	case al != bl:
		if al < bl {
			return -1
		}
		return 1
	case an != bn:
		if an < bn {
			return -1
		}
		return 1
	default:
		return 0
	}
}

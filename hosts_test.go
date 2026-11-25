package main

import (
	"strings"
	"testing"
)

func TestComputeHostsUpdatePreservesOrderWhenUnchanged(t *testing.T) {
	p1 := Profile{
		ID: "profile-a",
		Forwards: []PortForward{
			{LocalPort: 5432, RemoteHost: "pg.internal", RemotePort: 5432},
		},
	}
	p2 := Profile{
		ID: "profile-b",
		Forwards: []PortForward{
			{LocalPort: 6379, RemoteHost: "redis.internal", RemotePort: 6379},
		},
	}

	existing := "127.0.0.1\tlocalhost\n" +
		"127.0.0.1\tpg.internal\t# astra:profile-a\n" +
		"127.0.0.1\tredis.internal\t# astra:profile-b\n"

	got, _ := computeHostsUpdate(existing, p1, []Profile{p1, p2})
	if got != existing {
		t.Fatalf("expected unchanged hosts content when profile-a entry already exists above profile-b:\nwant:\n%q\ngot:\n%q", existing, got)
	}
}

func TestComputeHostsUpdateReplacesStaleIPAndRemovesDeletedForward(t *testing.T) {
	p1 := Profile{
		ID: "profile-a",
		Forwards: []PortForward{
			{LocalPort: 9093, RemoteHost: "broker1.internal", RemotePort: 9093},
			{LocalPort: 9093, RemoteHost: "broker2.internal", RemotePort: 9093},
		},
	}

	// broker2 previously mapped to 127.0.0.1, old.internal was removed
	existing := "127.0.0.1\tlocalhost\n" +
		"127.0.0.1\tbroker1.internal\t# astra:profile-a\n" +
		"127.0.0.1\tbroker2.internal\t# astra:profile-a\n" +
		"127.0.0.1\told.internal\t# astra:profile-a\n"

	got, ips := computeHostsUpdate(existing, p1, []Profile{p1})
	if len(ips) != 2 || ips[0] != "127.0.0.1" || ips[1] != "127.0.0.2" {
		t.Fatalf("unexpected bind IPs: %v", ips)
	}
	if strings.Contains(got, "old.internal") {
		t.Fatalf("expected removed forward old.internal to be dropped, got:\n%s", got)
	}
	if !strings.Contains(got, "127.0.0.1\tbroker1.internal\t# astra:profile-a") {
		t.Fatalf("expected broker1 entry preserved, got:\n%s", got)
	}
	if !strings.Contains(got, "127.0.0.2\tbroker2.internal\t# astra:profile-a") {
		t.Fatalf("expected broker2 updated to 127.0.0.2, got:\n%s", got)
	}

	// Second pass must be a no-op
	got2, _ := computeHostsUpdate(got, p1, []Profile{p1})
	if got2 != got {
		t.Fatalf("expected second pass to be a no-op:\nfirst:\n%q\nsecond:\n%q", got, got2)
	}
}

func TestComputeHostsUpdateDoesNotSubstringMatchOtherHosts(t *testing.T) {
	p := Profile{
		ID: "profile-a",
		Forwards: []PortForward{
			{LocalPort: 5432, RemoteHost: "db.internal", RemotePort: 5432},
		},
	}

	existing := "127.0.0.1\tmydb.internal\t# astra:profile-b\n"
	got, _ := computeHostsUpdate(existing, p, []Profile{p})
	if !strings.Contains(got, "127.0.0.1\tdb.internal\t# astra:profile-a") {
		t.Fatalf("expected db.internal to be added despite mydb.internal existing, got:\n%s", got)
	}
}

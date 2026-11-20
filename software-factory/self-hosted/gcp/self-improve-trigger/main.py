"""HTTP Cloud Function, called by Cloud Scheduler once a month (see
06-schedule-self-improvement.sh). Flags the next VM boot as a
self-improvement run instead of the usual weekly backlog run, then starts
the VM -- startup-script.sh reads and clears the flag.

Setting instance metadata needs the current metadata fingerprint, which a
static Cloud Scheduler HTTP body can't provide (it changes every write), so
this has to be a small function rather than a second Scheduler job hitting
the Compute API directly, same as stop-on-budget/ is for the kill switch.
"""
import os

import googleapiclient.discovery

PROJECT_ID = os.environ["PROJECT_ID"]
ZONE = os.environ.get("ZONE", "us-central1-a")
INSTANCE_NAME = os.environ.get("INSTANCE_NAME", "eggmodels-factory-vm")


def trigger_self_improvement(request):
    compute = googleapiclient.discovery.build("compute", "v1")

    instance = compute.instances().get(
        project=PROJECT_ID, zone=ZONE, instance=INSTANCE_NAME
    ).execute()
    fingerprint = instance["metadata"]["fingerprint"]
    items = [
        item for item in instance["metadata"].get("items", [])
        if item["key"] != "factory-mode"
    ]
    items.append({"key": "factory-mode", "value": "self-improve"})

    compute.instances().setMetadata(
        project=PROJECT_ID,
        zone=ZONE,
        instance=INSTANCE_NAME,
        body={"fingerprint": fingerprint, "items": items},
    ).execute()
    print("Set factory-mode=self-improve.")

    compute.instances().start(
        project=PROJECT_ID, zone=ZONE, instance=INSTANCE_NAME
    ).execute()
    print(f"Start request sent for {INSTANCE_NAME}.")
    return "ok"

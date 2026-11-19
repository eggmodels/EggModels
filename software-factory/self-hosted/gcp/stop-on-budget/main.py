"""Cloud Function triggered by the budget's Pub/Sub topic (see
04-set-budget.sh). Stops the factory VM -- nothing else -- once actual
spend reaches the budget amount. Leaves billing itself untouched, so it
can't affect any other project or service on the same billing account.
"""
import base64
import json
import os

import googleapiclient.discovery

PROJECT_ID = os.environ["PROJECT_ID"]
ZONE = os.environ.get("ZONE", "us-central1-a")
INSTANCE_NAME = os.environ.get("INSTANCE_NAME", "eggmodels-factory-vm")


def stop_vm_on_budget(event, context):
    pubsub_data = base64.b64decode(event["data"]).decode("utf-8")
    budget = json.loads(pubsub_data)

    cost = budget.get("costAmount", 0)
    cap = budget.get("budgetAmount", 0)
    if cap and cost < cap:
        print(f"Spend {cost} below budget {cap}; no action.")
        return

    print(f"Spend {cost} >= budget {cap}: stopping {INSTANCE_NAME}.")
    compute = googleapiclient.discovery.build("compute", "v1")
    compute.instances().stop(
        project=PROJECT_ID, zone=ZONE, instance=INSTANCE_NAME
    ).execute()
    print("Stop request sent.")

#!/bin/sh
set -eu

create_fifo_queue() {
  queue_name="$1"
  awslocal sqs create-queue \
    --queue-name "$queue_name" \
    --attributes FifoQueue=true,ContentBasedDeduplication=false \
    >/dev/null 2>&1 || true
}

create_fifo_queue wager-transactions-dlq.fifo
create_fifo_queue wager-transactions.fifo
create_fifo_queue wager-events.fifo

dlq_arn="$(awslocal sqs get-queue-attributes \
  --queue-url "http://localhost:4566/000000000000/wager-transactions-dlq.fifo" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

redrive_policy="{\"deadLetterTargetArn\":\"${dlq_arn}\",\"maxReceiveCount\":\"5\"}"

awslocal sqs set-queue-attributes \
  --queue-url "http://localhost:4566/000000000000/wager-transactions.fifo" \
  --attributes "RedrivePolicy=${redrive_policy}"

echo "SQS queues ready: wager-transactions.fifo, wager-transactions-dlq.fifo, wager-events.fifo"

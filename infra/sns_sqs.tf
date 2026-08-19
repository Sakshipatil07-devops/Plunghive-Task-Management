# Task lifecycle events (created/updated/deleted) are published to this
# topic by the API (server/src/services/sns.js) and fanned out to the
# queue below, which the worker process (server/src/worker/sqsWorker.js)
# polls and "delivers" (logs; would be email/Slack in a real system).

resource "aws_sns_topic" "task_events" {
  name = "${var.project_name}-task-events"
}

resource "aws_sqs_queue" "task_notifications" {
  name                       = "${var.project_name}-task-notifications"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400 # 1 day
}

resource "aws_sqs_queue_policy" "allow_sns" {
  queue_url = aws_sqs_queue.task_notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.task_notifications.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = aws_sns_topic.task_events.arn }
      }
    }]
  })
}

resource "aws_sns_topic_subscription" "queue_subscription" {
  topic_arn = aws_sns_topic.task_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.task_notifications.arn
}

output "alb_dns_name" {
  description = "Public URL of the app once deployed"
  value       = "http://${aws_lb.app.dns_name}"
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "s3_bucket_name" {
  value = aws_s3_bucket.attachments.bucket
}

output "sns_topic_arn" {
  value = aws_sns_topic.task_events.arn
}

output "sqs_queue_url" {
  value = aws_sqs_queue.task_notifications.url
}

output "opensearch_endpoint" {
  value = aws_opensearch_domain.tasks.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "cloudwatch_log_group" {
  value = aws_cloudwatch_log_group.app.name
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/pluginhive-taskmanager/app"
  retention_in_days = 7
}

resource "aws_cloudwatch_dashboard" "app" {
  dashboard_name = "${var.project_name}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ALB — 5xx count"
          region  = var.aws_region
          metrics = [["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.app.arn_suffix]]
          stat    = "Sum"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Fargate — CPU utilization"
          region  = var.aws_region
          metrics = [["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.app.name, "ClusterName", aws_ecs_cluster.main.name]]
          stat    = "Average"
          period  = 60
        }
      },
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "high_5xx" {
  alarm_name          = "${var.project_name}-high-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alarms when the app returns more than 5 server errors in a minute"

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short name used to prefix/tag all resources"
  type        = string
  default     = "pluginhive-taskmanager"
}

variable "container_port" {
  description = "Port the Node.js app listens on inside the container"
  type        = number
  default     = 4000
}

variable "fargate_cpu" {
  description = "Fargate task vCPU units (256 = 0.25 vCPU, smallest size)"
  type        = number
  default     = 256
}

variable "fargate_memory" {
  description = "Fargate task memory in MB (smallest size paired with 256 CPU)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of running Fargate tasks"
  type        = number
  default     = 1
}

# Stores task attachments. The app never exposes this bucket directly —
# all access goes through presigned URLs generated server-side
# (server/src/services/s3.js), so the bucket itself stays private.

resource "aws_s3_bucket" "attachments" {
  bucket = "${var.project_name}-attachments-${data.aws_caller_identity.current.account_id}"

  tags = { Project = var.project_name }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["*"] # tighten to the ALB DNS name / real domain post-interview
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

data "aws_caller_identity" "current" {}

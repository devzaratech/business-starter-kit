// Business Starter Kit - Jenkins declarative pipeline.
//
// This pipeline mirrors the GitHub Actions baseline so teams can run delivery on
// self-hosted Jenkins. It is intentionally tool-agnostic: SonarQube and
// deployment stages stay dormant unless explicitly enabled, so the default run
// works even on a minimal Jenkins controller.
//
// Expected agent tooling (configure as Jenkins Global Tools or install on the
// agent): JDK 17, Maven 3.9+, Node.js 20+, Docker CLI (only when BUILD_IMAGES or
// DEPLOY is used). See docs/ci-cd/jenkins-strategy.md.

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
        timeout(time: 60, unit: 'MINUTES')
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['none', 'dev', 'qa', 'uat', 'staging', 'prod'],
            description: 'Target environment for deployment. "none" runs build + tests only.'
        )
        booleanParam(
            name: 'RUN_SONAR',
            defaultValue: false,
            description: 'Run SonarQube analysis. Requires SONAR_HOST_URL and SONAR_TOKEN credentials.'
        )
        booleanParam(
            name: 'BUILD_IMAGES',
            defaultValue: false,
            description: 'Build Docker images for the application services.'
        )
        booleanParam(
            name: 'DEPLOY',
            defaultValue: false,
            description: 'Deploy to the selected ENVIRONMENT after a successful build.'
        )
        string(
            name: 'IMAGE_TAG',
            defaultValue: 'latest',
            description: 'Container image tag / Git SHA to deploy.'
        )
    }

    environment {
        // Resolved from Jenkins credentials when present; empty otherwise.
        SONAR_HOST_URL = "${env.SONAR_HOST_URL ?: ''}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Architecture guardrails') {
            steps {
                sh 'npm ci --ignore-scripts'
                sh 'npm run architecture:test'
                sh 'npm run declarations:test'
                sh 'npm run compose:test'
                sh 'npm run architecture:check'
            }
        }

        stage('Spring Boot API tests') {
            steps {
                dir('apps/api-spring') {
                    sh 'mvn --batch-mode test'
                }
            }
        }

        stage('Node, worker and web tests') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Docker Compose validation') {
            steps {
                sh 'npm run infrastructure:test'
            }
        }

        stage('SonarQube analysis') {
            when {
                expression { return params.RUN_SONAR }
            }
            steps {
                // The script skips gracefully if SonarQube is not configured.
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    sh './scripts/quality/run-sonar-scan.sh'
                }
            }
        }

        stage('Build images') {
            when {
                expression { return params.BUILD_IMAGES || params.DEPLOY }
            }
            steps {
                sh '''
                    IMAGE_TAG="${IMAGE_TAG}" docker compose \
                        -f infra/compose/docker-compose.vps.yml \
                        --profile apps build
                '''
            }
        }

        stage('Production approval') {
            when {
                allOf {
                    expression { return params.DEPLOY }
                    expression { return params.ENVIRONMENT == 'prod' }
                }
            }
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Approve PRODUCTION deployment?', ok: 'Deploy to prod'
                }
            }
        }

        stage('Deploy') {
            when {
                allOf {
                    expression { return params.DEPLOY }
                    expression { return params.ENVIRONMENT != 'none' }
                }
            }
            steps {
                echo "Deploying image tag '${params.IMAGE_TAG}' to '${params.ENVIRONMENT}'."
                sh """
                    IMAGE_TAG='${params.IMAGE_TAG}' \
                    ./scripts/deploy/restart-compose.sh '${params.ENVIRONMENT}'
                """
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Review the failed stage logs above.'
        }
        always {
            echo "Build #${env.BUILD_NUMBER} finished with result: ${currentBuild.currentResult}"
        }
    }
}

# syntax=docker/dockerfile:1

# ----- Build stage -----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
# Pre-fetch dependencies to leverage Docker layer caching.
RUN mvn --batch-mode -q dependency:go-offline
COPY src ./src
RUN mvn --batch-mode -q clean package -DskipTests

# ----- Runtime stage -----
FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
# Run as a non-root user.
RUN useradd --system --uid 1001 --create-home appuser
COPY --from=build /workspace/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]

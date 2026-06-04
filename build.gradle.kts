plugins {
    id("com.github.node-gradle.node") version "7.1.0"
    idea
}

node {
    // Use the Node.js version installed on the system (via nvm or similar).
    // Set download = false to use system Node; set to true with explicit version
    // to let Gradle manage a dedicated Node.js installation.
    version.set("20.20.2")
    download.set(false)
    // If download were true, workDir would control where Node/npm are placed:
    // workDir.set(file("${project.projectDir}/.gradle/nodejs"))
}

idea {
    module {
        // Mark src/ as a top-level source root so IntelliJ recognizes it.
        sourceDirs.add(file("src"))
        // Mark the generated main.js and other artifacts as excluded.
        excludeDirs.addAll(listOf(
            file("node_modules"),
            file(".gradle"),
        ))
    }
}

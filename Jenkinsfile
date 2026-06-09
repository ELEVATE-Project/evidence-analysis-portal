node('build-slave') {
    try {

        String ANSI_GREEN = "[32m"
        String ANSI_NORMAL = "[0m"
        String ANSI_BOLD = "[1m"
        String ANSI_RED = "[31m"
        String ANSI_YELLOW = "[33m"

        ansiColor('xterm') {
            stage('Checkout') {
                if (!env.hub_org) {
                    println(ANSI_BOLD + ANSI_RED + "Uh Oh! Please set a Jenkins environment variable named hub_org" + ANSI_NORMAL)
                    error 'Please resolve the errors and rerun..'
                } else
                    println(ANSI_BOLD + ANSI_GREEN + "Found environment variable hub_org: " + hub_org + ANSI_NORMAL)
            }

            cleanWs()
            checkout scm
            commit_hash = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
            build_tag = sh(script: "echo " + params.github_release_tag.split('/')[-1] + "_" + commit_hash + "_" + env.BUILD_NUMBER, returnStdout: true).trim()
            echo "build_tag: " + build_tag

            stage('Deploy') {
                ansiblePlaybook(
                    playbook: 'deployment/ansible.yml',
                    inventory: params.inventory,
                    extras: "-e gitBranch=${params.github_release_tag} -e vaultAddress=${params.vaultAddress}"
                )
            }

            stage('ArchiveArtifacts') {
                sh("echo ${build_tag} > build_tag.txt")
                archiveArtifacts "build_tag.txt"
                currentBuild.description = "${build_tag}"
            }
        }
    }
    catch (err) {
        currentBuild.result = "FAILURE"
        throw err
    }
}

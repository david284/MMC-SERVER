#!/usr/bin/env bash
set -eEuo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
ORANGE='\033[0;33m'
NC='\033[0m'
BOLD='\033[1m'

MMC_NAME=MMC
MMCSERVER_NAME=MMC-SERVER
MMCSERVER_GIT_NS="${MMCSERVER_GIT_NS:-david284/${MMCSERVER_NAME}}"
MMCSERVER_URL="https://github.com/${MMCSERVER_GIT_NS}.git"
INSTALL_DIR="${HOME}/${MMC_NAME}"
LOG_FILE="$(mktemp)"

printBoldMsg() {
  echo
  echo -e "${BOLD}${1}${NC}"
  echo
}

printImportantMsg() {
  echo -e "${ORANGE}IMPORTANT!!!: ${1}${NC}"
}

printInfoMsg() {
  echo -e "${ORANGE}Info: ${1}...${NC}"
}

printWarningMsg() {
  echo -e "${ORANGE}Warning: ${1}${NC}"
}

printSuccessMsg() {
  echo -e "${GREEN}Success: ${1}${NC}"
}

printErrorMsg() {
  echo -e "${RED}ERROR!!!: ${1}${NC}"
  echo
}

print_stacktrace() {
  local _status_code=$1

  echo
  echo "ERROR! Failed in ${BASH_SOURCE[2]}:${BASH_LINENO[1]} - '${BASH_COMMAND}' exited with status $_status_code"

  #FUNCNAME[0]=this function - we do not want to print that!
  local i _level
  if [[ ${#FUNCNAME[@]} -gt 2 ]]; then #if it were 2, then that would only be "main" & this function, so no stack to print
    for ((i=2;i<${#FUNCNAME[@]}-1;i++)); do
      # shellcheck disable=SC2004
      for ((_level=1;_level<$i;_level++)); do
        echo -n "  "
      done
      echo " ${BASH_SOURCE[$i+1]}:${BASH_LINENO[$i]}, calling: ${FUNCNAME[$i]}(...)"
    done
  fi
  echo
}

on_exit() {
  if [ ! -z "${VERBOSE_PID:-}" ]; then
    disown "${VERBOSE_PID}"
    kill "${VERBOSE_PID}" 2>&1
  fi
}

on_error() {
    local _status_code=$?

    echo -e -n "${RED}" >&2
    print_stacktrace "${_status_code}" >&2
    echo -e -n "${NC}" >&2
    printErrorMsg "A problem has been encountered - please examine the ${LOG_FILE} log file"
    exit ${_status_code}
}

getConfirmation() {
  local _msg="${1}"
  local _answer

  [ -z "${ASSUME_YES:-}" ] || return 0

  echo
  while true; do
    read -r -p "${_msg} (y/n/q): " _answer
    case ${_answer} in
      [Yy]* )
        return 0;;
      [Nn]* )
        return 1;;
      [Qq]* )
        exit 1;;
      * ) echo "Please answer yes or no.";;
    esac
  done
}

installNodeOnMacOS() {
  if command -v "node" >> "${LOG_FILE}" 2>&1; then
    printInfoMsg "Node.js is already installed"
  else
    if [ ! -w ~/.bashrc ] && \
       [ ! -w ~/.bash_profile ] && \
       [ ! -w  ~/.zprofile ] && \
       [ ! -w ~/.zshrc ] && \
       [ ! -w ~/.profile ]; then
      printImportantMsg "Your environment cannot be modified to setup node"
      printImportantMsg "To rectify, create an (empty) apropriate file for your shell e.g. choose from: ~/.bashrc, ~/.bash_profile, ~/.zprofile, ~/.zshrc, and ~/.profile"
      printImportantMsg "e.g. touch ~/.zshrc"
      printImportantMsg "Please do this now, before continuing any further"
    fi
    if getConfirmation "Do you wish to install Node.js"; then
      if ! xcode-select -p >> "${LOG_FILE}" 2>&1; then
        if getConfirmation "Do you wish to install the Xcode Command Line Developer Tools"; then
          printInfoMsg "Installing Xcode Command Line Developer Tools"
          xcode-select --install
          while ! xcode-select -p >/dev/null 2>&1; do
            sleep 5
          done
          printSuccessMsg "Xcode Command Line Developer Tools installed"
        fi
      fi

      printInfoMsg "Installing Node.js"

      # https://nodejs.org/en/download
      #
      # Download and install nvm:
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

      # in lieu of restarting the shell
      export NVM_DIR="${HOME}/.nvm"

      # The nvm scripts do not trap exit codes > 0, so we have to relax our settings...
      set +eEuo
      # shellcheck disable=SC1091
      [ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"  # This loads nvm
      # shellcheck disable=SC1091
      [ -s "${NVM_DIR}/bash_completion" ] && \. "${NVM_DIR}/bash_completion"

      # Download and install Node.js:
      nvm install 24

      # Restore our settings
      set -eEuo pipefail
      [ -n "${VERBOSE:-}" ] && set -x || true

      # Verify the Node.js version:
      if [ "$(node -v)" != "v24.13.0" ]; then
        printWarningMsg "Incorrect node version received - s/be v24.13.0, but was $(node -v)"
      fi

      # Verify npm version:
      if [ "$(npm -v)" != "11.6.2" ]; then
        printWarningMsg "Incorrect npm version received - s/be 11.6.2, but was $(npm -v)"
      fi

      PRINT_NODE_INFO=true
      printSuccessMsg "Node.js installed"
    fi
  fi
}

installPkgOnLinux() {
  local _pkg=${1}

  if command -v "${_pkg}" >> "${LOG_FILE}" 2>&1; then
    printInfoMsg "${_pkg} is already installed"
    updatePkg "${_pkg}"
  else
    if getConfirmation "Do you wish to install ${_pkg}?"; then
      printInfoMsg "Installing ${_pkg}"
      if [ -z "${isPkgMgrUpdated:-}" ]; then
        # shellcheck disable=SC2024
        sudo apt-get -y update >> "${LOG_FILE}" 2>&1
        isPkgMgrUpdated=true
      fi
      # shellcheck disable=SC2024
      sudo apt-get -y install "${_pkg}" >> "${LOG_FILE}" 2>&1
      printSuccessMsg "${_pkg} installed"
    fi
  fi
}

updatePkg() {
  local _pkg=${1}

  if getConfirmation "Do you wish to update ${_pkg}?"; then
    printInfoMsg "Updating ${_pkg}"
    if [ -z "${isPkgMgrUpdated:-}" ]; then
      if [ "${OS}" == "Linux" ]; then
        # shellcheck disable=SC2024
        sudo apt-get -y update >> "${LOG_FILE}" 2>&1
      else
        brew update -q >> "${LOG_FILE}" 2>&1
      fi
      isPkgMgrUpdated=true
    fi
    if [ "${OS}" == "Linux" ]; then
      # shellcheck disable=SC2024
      sudo apt-get -y upgrade "${_pkg}" >> "${LOG_FILE}" 2>&1
    else
      brew upgrade "${_pkg}" >> "${LOG_FILE}" 2>&1
    fi
    printSuccessMsg "${_pkg} updated"
  fi
}

print_help() {
  local _installScript="https://raw.githubusercontent.com/${MMCSERVER_GIT_NS}/refs/heads/${MMCSERVER_GIT_BRANCH:-main}/InstallAndRun/LinuxAndMacOS/installMMC.sh"

  cat << EOF

Installs and/or updates ${MMC_NAME} locally

To install, execute:
    bash <(curl -fsSLo- ${_installScript})

To use any of the runtime arguments mentioned in this help, specify them at the end of the command e.g. to show this help page:
    bash <(curl -fsSLo- ${_installScript}) -h

By default, the script will prompt you before invoking some actions (installing packages etc.); specifying the "-y" runtime argument will not prompt
    bash <(curl -fsSLo- ${_installScript}) -y

See https://github.com/${MMCSERVER_GIT_NS}

Optional Arguments:
	-i <install_dir>	Specify the installation directory (default: ${INSTALL_DIR})
	-q			Be quieter
	-v			Verbose mode
	-y			Assume 'yes' to all answers i.e. you will NOT be prompted to confirm actions
	-h			Display this help message
EOF
  exit 1
}

createMacosShortcuts() {
  if getConfirmation "Do you wish to create a desktop shortcut?"; then
    printInfoMsg "Creating desktop shortcut"

    cat <<EOF > "${HOME}/Desktop/${MMC_DESKTOP_NAME}"
#!/usr/bin/env bash
cd ${MMC_DIR}
npm run start
EOF
    chmod +x "${HOME}/Desktop/${MMC_DESKTOP_NAME}"
    printSuccessMsg "Desktop shortcut created ($(echo "${HOME}/Desktop/${MMC_DESKTOP_NAME}"))"
  fi
}

createLinuxShortcuts() {
  local _file="${HOME}/.local/share/applications/${MMC_DESKTOP_NAME}"

  if getConfirmation "Do you wish to create a desktop shortcut?"; then
    printInfoMsg "Creating desktop entry file"
    cat << EOF > "${_file}"
[Desktop Entry]
Encoding=UTF-8
Version=1.0
Name=${MMC_NAME}
Comment=Start the CBUS/VLCB Module Management Configuration tool
GenericName=Module Management Configuration
Type=Application
Terminal=true
Categories=System;
Path=${MMC_DIR}
Exec=npm start
Icon=${MMC_DIR}/InstallAndRun/LinuxAndMacOS/MMCicon-256.png
EOF

    ln -fsr "${_file}" "${HOME}/Desktop/"
    gio set "${HOME}/Desktop/${MMC_DESKTOP_NAME}" metadata::trusted true
    chmod +x "${HOME}/Desktop/${MMC_DESKTOP_NAME}"
    printSuccessMsg "Desktop shortcut created ($(echo "${HOME}/Desktop/${MMC_DESKTOP_NAME}"))"
  fi
}

stopMMC() {
  local _pid

  if getConfirmation "Do you wish to stop MMC running if it's running?"; then
    printInfoMsg "Stopping MMC (if it's running)..."
    if pkill -f "node ./main.js" >> "${LOG_FILE}" 2>&1; then
      printSuccessMsg "MMC has been stopped"
    else
      printInfoMsg "MMC was not running"
    fi
  fi
  echo
}

while getopts 'i:qvyh' OPTION; do
  case "$OPTION" in
    i)
      INSTALL_DIR="${OPTARG}"
      ;;
    q)
      BE_QUIET=true
      ;;
    v)
      VERBOSE=true
      set -x
      ;;
    y)
      ASSUME_YES=true
      ;;
    h|?)
      print_help
      ;;
  esac
done

trap 'on_exit' EXIT
trap 'on_error' ERR INT

if [ -z "${BE_QUIET:-}" ]; then
  tail -F "${LOG_FILE}" &
  VERBOSE_PID=$!
fi

MMC_DIR="${INSTALL_DIR}/${MMCSERVER_NAME}"

case "$(uname)" in
  Darwin)
    OS=macOS
    ;;
  Linux)
    OS=Linux
    PKG_LIST="npm"  # This also installs node & git
    ;;
  *)
    echo
    printErrorMsg "Unknown OS ($(uname)) - Cannot continue"
    exit 1
    ;;
esac

if [ "${OS}" == Linux ]; then
  MMC_DESKTOP_NAME="${MMC_NAME}.desktop"
else
  MMC_DESKTOP_NAME="${MMC_NAME}.command"
fi

printBoldMsg "Welcome to the ${MMC_NAME} installer for ${OS}"
printBoldMsg "Note: All command output will be logged to: ${LOG_FILE}; please examine that file if you have problems"
echo

printInfoMsg "Will install to ${INSTALL_DIR}"

if ! getConfirmation "Do you wish to continue?"; then exit 1; fi

if [ "${OS}" == "macOS" ]; then
  installNodeOnMacOS
else
  for _pkg in ${PKG_LIST}; do
    installPkgOnLinux "${_pkg}"
  done
fi

stopMMC

if [ -d "${INSTALL_DIR}" ]; then
  printInfoMsg "Installation directory (${INSTALL_DIR}) already exists"
else
  if getConfirmation "Do you wish to create the installation directory: ${INSTALL_DIR}?"; then
    mkdir -p "${INSTALL_DIR}" || {
      printErrorMsg "Unable to create installation directory: ${INSTALL_DIR}"
      echo
      exit 1
    }
    printSuccessMsg "Installation directory (${INSTALL_DIR}) created"
  fi
fi

if [ ! -d "$(dirname ${MMC_DIR})" ]; then
  echo
  printErrorMsg "Parent directory of application directory ${MMC_DIR} does not exist - cannot continue"
  echo
  exit 1
fi

if [ -d "${MMC_DIR}" ]; then
  if getConfirmation "Do you wish to fetch the latest git repo changes into ${MMC_DIR}?"; then
    printInfoMsg "Updating git repo"
    git -C "${MMC_DIR}" pull >> "${LOG_FILE}" 2>&1
    printSuccessMsg "${MMC_DIR} now updated"
  fi
else
  printInfoMsg "Fetching ${MMCSERVER_NAME} from git into ${MMC_DIR}"
  if [ -n "${MMCSERVER_GIT_BRANCH:-}" ]; then
    (cd "${INSTALL_DIR}"; git clone -b "${MMCSERVER_GIT_BRANCH}" --single-branch "${MMCSERVER_URL}" >> "${LOG_FILE}" 2>&1)
  else
    (cd "${INSTALL_DIR}"; git clone "${MMCSERVER_URL}" >> "${LOG_FILE}" 2>&1)
  fi
  printSuccessMsg "${MMC_DIR} now exists"
fi

if [ -f "${MMC_DIR}/package-lock.json" ]; then
  if getConfirmation "Do you wish to update the ${MMC_NAME} node modules?"; then
    printInfoMsg "Updating ${MMC_NAME} node modules"
    (cd "${MMC_DIR}"; npm update >> "${LOG_FILE}" 2>&1)
    printSuccessMsg "${MMC_NAME} node modules now updated"
  fi
else
  printInfoMsg "Installing ${MMC_NAME} node modules"
  (cd "${MMC_DIR}"; npm install >> "${LOG_FILE}" 2>&1)
  printSuccessMsg "${MMC_NAME} node modules now installed"
fi

if [ "${OS}" == "Linux" ]; then
  createLinuxShortcuts
else
  createMacosShortcuts
fi

printBoldMsg "Completed installation of ${MMC_NAME}!"

if [ -n "${PRINT_NODE_INFO:-}" ]; then
  printImportantMsg "You will need to log out and back in to pickup changes to your environment"
  echo
fi

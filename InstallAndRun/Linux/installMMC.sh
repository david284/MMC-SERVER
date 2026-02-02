#!/usr/bin/env bash
set -eEuo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
ORANGE='\033[0;33m'
NC='\033[0m'
BOLD='\033[1m'

MMC_NAME=MMC
MMCSERVER_NAME=MMC-SERVER
MMCSERVER_GIT_NS="david284/${MMCSERVER_NAME}"
MMCSERVER_URL="https://github.com/${MMCSERVER_GIT_NS}.git"
INSTALL_DIR="${HOME}/${MMC_NAME}"
PKG_LIST="nodejs npm git"
LOG_FILE="$(mktemp)"

printBoldMsg() {
  echo
  echo -e "${BOLD}${1}${NC}"
  echo
}

printInfoMsg() {
  echo -e "${ORANGE}Info: ${1}...${NC}"
}

printSuccessMsg() {
  echo -e "${GREEN}Success: ${1}${NC}"
}

printErrorMsg() {
  echo -e "${RED}ERROR!!!: ${1}${NC}"
  echo
}

on_error()
{
    local _status_code=$?

    printErrorMsg "A problem has been encountered - please examine the ${LOG_FILE} log file"
    exit ${_status_code}
}

installPkg() {
  local _pkg=${1}

  if command -v "${_pkg}" > /dev/null; then
    printSuccessMsg "${_pkg} is already installed"
  else
    printInfoMsg "Installing ${_pkg}"
    if [ -z "${isAptUpdated:-}" ]; then
      sudo apt-get -y update >> "${LOG_FILE}" 2>&1
      isAptUpdated=true
    fi
    sudo apt-get -y install ${_pkg} >> "${LOG_FILE}" 2>&1
    printSuccessMsg "${_pkg} installed"
  fi
}

updatePkg() {
  local _pkg=${1}

  printInfoMsg "Updating ${_pkg}"
  if [ -z "${isAptUpdated:-}" ]; then
    sudo apt-get -y update >> "${LOG_FILE}" 2>&1
    isAptUpdated=true
  fi
  sudo apt-get -y upgrade ${_pkg} >> "${LOG_FILE}" 2>&1
  printSuccessMsg "${_pkg} updated"
}

print_help() {
  local _installScript="https://raw.githubusercontent.com/${MMCSERVER_GIT_NS}/refs/heads/main/InstallAndRun/Linux/installMMC.sh"

  cat << EOF

Installs and/or updates ${MMC_NAME} locally

To install, execute:
    bash <(curl -fsSLo- ${_installScript})

To use any of the runtime arguments mentioned in this help, specify them at the end of the command e.g. to show this help page:
    bash <(curl -fsSLo- ${_installScript}) -h

By default, the script assumes you wish to install everything. However, if you just wish to update everything for an existing installation, specify the "-u" runtime argument:
    bash <(curl -fsSLo- ${_installScript}) -u

See https://github.com/${MMCSERVER_GIT_NS}

Optional Arguments:
	-i <install_dir>	Specify the installation directory (default: ${INSTALL_DIR})
	-u			Update everything e.g. OS packages, ${MMCSERVER_NAME} git repository & node.js modules (by default, nothing will be updated)
	-h			Display this help message
EOF
  exit 1
}

createDesktopEntry() {
  local _file="${HOME}/.local/share/applications/${MMC_NAME}.desktop"

  printInfoMsg "Creating desktop entry file"
  cat << _EOF_ > "${_file}"
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
Icon=${MMC_DIR}/InstallAndRun/Linux/MMCicon-256.png
_EOF_

  ln -fsr "${_file}" "${HOME}/Desktop/"
  gio set "${HOME}/Desktop/${MMC_NAME}.desktop" metadata::trusted true
  printSuccessMsg "Desktop entry file created"
}

stopMMC() {
  printInfoMsg "Stopping MMC if it's running..."
  if kill $(ps -C node --no-header -o pid,command|grep "node ./main.js" | awk '{print $1}') > /dev/null 2>&1; then
    printSuccessMsg "MMC has been stopped"
  else
    printSuccessMsg "MMC was not running"
  fi
}

while getopts 'i:uh' OPTION; do
  case "$OPTION" in
    i)
      INSTALL_DIR="${OPTARG}"
      ;;
    u)
      UPDATE_ALL=true
      ;;
    h|?)
      print_help
      ;;
  esac
done

trap 'on_error' ERR TERM INT SIGINT SIGTERM HUP QUIT

MMC_DIR="${INSTALL_DIR}/${MMCSERVER_NAME}"

printBoldMsg "Welcome to the ${MMC_NAME} installer for Linux"
printBoldMsg "Note: All command output will be logged to: ${LOG_FILE}; examine that file if you have problems"
echo
printInfoMsg "Will install to ${INSTALL_DIR}"
#  ensure installation directory can be created
mkdir -p "${INSTALL_DIR}" || {
  printErrorMsg "Unable to create installation directory: ${INSTALL_DIR}"
  echo
  exit 1
}

printSuccessMsg "Installation directory exists: ${INSTALL_DIR}"

for _pkg in ${PKG_LIST}; do
  installPkg "${_pkg}"
done

stopMMC

if [ ! -d "${MMC_DIR}" ]; then
  printInfoMsg "Fetching ${MMCSERVER_NAME} from git"
  (cd "${INSTALL_DIR}"; git clone "${MMCSERVER_URL}" >> "${LOG_FILE}" 2>&1)
  printSuccessMsg "${MMCSERVER_NAME} now exists"
fi

if [ ! -f "${MMC_DIR}/package-lock.json" ]; then
  printInfoMsg "Installing ${MMC_NAME}"
  (cd "${MMC_DIR}"; npm install >> "${LOG_FILE}" 2>&1)
  printSuccessMsg "${MMC_NAME} now installed"
fi

if [ -n "${UPDATE_ALL:-}" ]; then
  for _pkg in ${PKG_LIST}; do
    updatePkg "${_pkg}"
  done

  printInfoMsg "Updating git repo"
  git -C "${MMC_DIR}" pull >> "${LOG_FILE}" 2>&1
  printSuccessMsg "git repo now updated"

  printInfoMsg "Updating ${MMC_NAME}"
  (cd "${MMC_DIR}"; npm update >> "${LOG_FILE}" 2>&1)
  printSuccessMsg "${MMC_NAME} now updated"
fi

createDesktopEntry

printBoldMsg "Completed installation of ${MMC_NAME}!"

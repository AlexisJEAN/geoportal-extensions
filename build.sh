#!/bin/bash

# Script de construction des bundles
# ./build.sh -a(all)
#     -o(openlayers)
#     -l(leaflet)
#     -i(itowns)

# FIXME incompatibilité avec un env. Windows

##########
# doCmd()

doCmd () {
    cmd2issue=$1
    eval ${cmd2issue}
    retour=$?
    if [ $retour -ne 0 ] ; then
        printTo "Erreur d'execution (code:${retour}) !..."
        exit 100
    fi
}

##########
# printTo()

printTo () {
    text=$1
    d=`date`
    echo "[${d}] ${text}"
}

printTo "BEGIN"

##########
# clean
function clean() {
    # pas de tests...
    printTo "####### CLEAN !"
    doCmd "rm -rf dist/$1"
    doCmd "rm -rf samples/$1"
    doCmd "rm -rf jsdoc/$1"
}

##########
# leaflet
function leaflet() {
  printTo "####### LEAFLET !"
  doCmd "npm run build:leaflet:src"
  printTo "####### LEAFLET production !"
  doCmd "npm run build:leaflet:prod"
  printTo "####### LEAFLET development !"
  doCmd "npm run build:leaflet:dev"
}

##########
# ol
function ol() {
  printTo "####### OL !"
  doCmd "npm run build:ol:src"
  printTo "####### OL production !"
  doCmd "npm run build:ol:prod"
  printTo "####### OL development !"
  doCmd "npm run build:ol:dev"
}

##########
# itowns
function itowns() {
  printTo "####### iTowns !"
  doCmd "npm run build:itowns"
  printTo "####### iTowns production !"
  doCmd "npm run build:itowns:prod"
  printTo "####### iTowns development !"
  doCmd "npm run build:itowns:dev"
}

printTo "###########  NPM  ##############"
doCmd "npm run setup"

while getopts "aoliI" opts
do
   case $opts in
     o)
        printTo "#################################"
        printTo "###### OpenLayers bundle ! ######"
        clean "openlayers"
        ol
        ;;
     l)
        printTo "#################################"
        printTo "####### Leaflet bundle ! ########"
        clean "leaflet"
        leaflet
        ;;
     i)
        printTo "#############################"
        printTo "###### Itowns bundle ! ######"
        clean "itowns"
        itowns
        ;;
     a)
        printTo "#################################"
        printTo "########## ALL bundle ! #########"
        clean "openlayers"
        ol
        clean "leaflet"
        leaflet
        clean "itowns"
        itowns
        ;;
     \?)
        printTo "$OPTARG : option invalide : a(all), o(openlayers), l(leaflet), i(itowns) !"
        exit -1
        ;;
   esac
done

printTo "END"
exit 0

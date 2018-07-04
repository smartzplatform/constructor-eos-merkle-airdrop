cmake_minimum_required(VERSION 3.9)
project(eos_merkle_airdrop)

set(CMAKE_CXX_STANDARD 14)

include_directories(/home/algys/sources/eos/contracts/)

add_executable(eos_merkle_airdrop
        merkle-airdrop.cpp)
